import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateUUIDv7 } from '@/lib/audit/uuid';
import { sanitizeData } from '@/lib/audit/sanitizer';
import { extractSearchTokens, normalizeText, tokenize } from '@/lib/audit/tokens';
import { calculateEventHash, verifyEventHash } from '@/lib/audit/hash';
import { buildAuditEnvelope } from '@/lib/audit/client';

describe('audit: uuidv7', () => {
  it('generates valid UUIDv7 format with correct version and variant', () => {
    const id = generateUUIDv7();
    // 8-4-4-4-12 hex format
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates strictly monotonically increasing IDs over time', () => {
    const id1 = generateUUIDv7();
    const id2 = generateUUIDv7();
    assert.ok(id1 < id2, `id1 (${id1}) should be less than id2 (${id2})`);
  });
});

describe('audit: sanitizer (LGPD)', () => {
  it('redacts sensitive keys like password, token, cvv, creditCard', () => {
    const payload = {
      user: 'joao',
      password: 'mypassword123',
      currentPassword: 'oldpassword',
      authToken: 'eyJhbGciOi...',
      cvv: '123',
      credit_card: '4111222233334444',
      nested: {
        api_key: 'sk_live_123',
        normalField: 'ok',
      },
    };

    const sanitized = sanitizeData(payload);

    assert.equal(sanitized.password, '[REDACTED]');
    assert.equal(sanitized.currentPassword, '[REDACTED]');
    assert.equal(sanitized.authToken, '[REDACTED]');
    assert.equal(sanitized.cvv, '[REDACTED]');
    assert.equal(sanitized.credit_card, '[REDACTED]');
    assert.equal(sanitized.nested.api_key, '[REDACTED]');
    assert.equal(sanitized.nested.normalField, 'ok');
    assert.equal(sanitized.user, 'joao');
  });

  it('masks CPFs and credit card numbers in free text', () => {
    const textWithCpf = 'O colaborador com CPF 123.456.789-01 solicitou reembolso';
    const sanitizedCpf = sanitizeData(textWithCpf);
    assert.equal(sanitizedCpf, 'O colaborador com CPF ***.456.789-** solicitou reembolso');

    const textWithCard = 'Pagamento efetuado com cartão 4111 2222 3333 4444 no balcão';
    const sanitizedCard = sanitizeData(textWithCard);
    assert.equal(sanitizedCard, 'Pagamento efetuado com cartão **** **** **** 4444 no balcão');
  });

  it('enforces maximum depth to avoid memory bloat', () => {
    const deepObj = { a: { b: { c: { d: 'too deep' } } } };
    const sanitized = sanitizeData(deepObj, 0, 3);
    assert.equal((sanitized as any).a.b.c, '[MAX_DEPTH_REACHED]');
  });
});

describe('audit: search tokens', () => {
  it('normalizes diacritics and converts to lowercase', () => {
    assert.equal(normalizeText('AQUISIÇÃO de Veículo'), 'aquisicao de veiculo');
  });

  it('tokenizes text into words of length >= 2', () => {
    const tokens = tokenize('Contrato 45/2026 - Prefeitura de Caruaru');
    assert.deepEqual(tokens, ['contrato', '45', '2026', 'prefeitura', 'de', 'caruaru']);
  });

  it('extracts tokens from envelope targets, action, and actor', () => {
    const tokens = extractSearchTokens({
      system: 'raropay',
      category: 'finance',
      action: 'expense.approved',
      actor: {
        type: 'user',
        name: 'Carlos Oliveira',
        email: 'carlos@empresa.com',
      },
      targets: [
        {
          type: 'expense',
          id: '1755',
          label: 'Combustível Posto Shell Caruaru',
        },
      ],
    });

    assert.ok(tokens.includes('raropay'));
    assert.ok(tokens.includes('expense'));
    assert.ok(tokens.includes('approved'));
    assert.ok(tokens.includes('carlos'));
    assert.ok(tokens.includes('1755'));
    assert.ok(tokens.includes('shell'));
    assert.ok(tokens.includes('caruaru'));
  });
});

describe('audit: cryptographic hash chaining', () => {
  it('calculates deterministic SHA-256 hash and verifies it', () => {
    const envelope = buildAuditEnvelope({
      system: 'raronexus',
      category: 'auth',
      action: 'user.login',
      actor: { type: 'user', userId: 'usr_1', email: 'test@rarotec.com' },
      targets: [{ type: 'user', id: 'usr_1', label: 'Test User' }],
      details: { ip: '127.0.0.1' },
    });

    assert.ok(envelope.hash);
    assert.equal(typeof envelope.hash, 'string');
    assert.equal(envelope.hash.length, 64);
    assert.ok(verifyEventHash(envelope));
  });

  it('detects tampering when payload is modified after signing', () => {
    const envelope = buildAuditEnvelope({
      system: 'raronexus',
      category: 'admin',
      action: 'user.role_changed',
      actor: { type: 'user', userId: 'adm_1' },
      targets: [{ type: 'user', id: 'usr_2', label: 'Operador' }],
      details: { role: 'admin' },
    });

    assert.ok(verifyEventHash(envelope));

    // Adulteração intencional
    envelope.details.role = 'super_admin';
    assert.equal(verifyEventHash(envelope), false);
  });
});

describe('audit: administrative and operational action envelopes', () => {
  it('builds valid envelope for constant.created and constant.versioned with diff calculation', () => {
    const createdEnv = buildAuditEnvelope({
      system: 'raronexus',
      category: 'constants',
      action: 'constant.created',
      severity: 'INFO',
      status: 'SUCCESS',
      actor: { type: 'user', userId: 'usr_1', email: 'admin@raro.io', role: 'admin' },
      targets: [{ type: 'constant', id: 'c_1', label: 'APP_CONFIG' }],
      details: { name: 'APP_CONFIG', is_public: false, current_version: 1 },
    });

    assert.equal(createdEnv.action, 'constant.created');
    assert.equal(createdEnv.severity, 'INFO');
    assert.ok(verifyEventHash(createdEnv));

    const versionedEnv = buildAuditEnvelope({
      system: 'raronexus',
      category: 'constants',
      action: 'constant.versioned',
      severity: 'INFO',
      status: 'SUCCESS',
      actor: { type: 'user', userId: 'usr_1', email: 'admin@raro.io', role: 'admin' },
      targets: [{ type: 'constant', id: 'c_1', label: 'APP_CONFIG' }],
      diff: {
        before: { version: 1, is_public: false },
        after: { version: 2, is_public: true },
      },
      details: { previous_version: 1, current_version: 2 },
    });

    assert.equal(versionedEnv.action, 'constant.versioned');
    assert.ok(versionedEnv.changes);
    assert.equal(versionedEnv.changes.length, 2);
    const versionChange = versionedEnv.changes.find(c => c.field === 'version');
    assert.deepEqual(versionChange, { field: 'version', before: 1, after: 2 });
    assert.ok(verifyEventHash(versionedEnv));
  });

  it('builds valid envelope for sso access denied and token issued', () => {
    const deniedEnv = buildAuditEnvelope({
      system: 'raronexus',
      category: 'auth',
      action: 'auth.sso_access_denied',
      severity: 'WARNING',
      status: 'FAILURE',
      actor: { type: 'user', userId: 'usr_2', email: 'denied@raro.io', role: 'user' },
      targets: [{ type: 'application', id: 'app_rarostock', label: 'rarostock' }],
      details: { client_id: 'rarostock', reason: 'nao_autorizado' },
    });

    assert.equal(deniedEnv.action, 'auth.sso_access_denied');
    assert.equal(deniedEnv.severity, 'WARNING');
    assert.equal(deniedEnv.status, 'FAILURE');
    assert.ok(verifyEventHash(deniedEnv));

    const tokenEnv = buildAuditEnvelope({
      system: 'raronexus',
      category: 'auth',
      action: 'auth.sso_token_issued',
      severity: 'INFO',
      status: 'SUCCESS',
      actor: { type: 'user', userId: 'usr_3', email: 'allowed@raro.io', role: 'admin' },
      targets: [
        { type: 'application', id: 'app_1', label: 'RaroStock' },
        { type: 'user', id: 'usr_3', label: 'Allowed User' },
      ],
      details: { platform: 'RaroStock', client_id: 'rarostock', role: 'admin' },
    });

    assert.equal(tokenEnv.action, 'auth.sso_token_issued');
    assert.equal(tokenEnv.severity, 'INFO');
    assert.equal(tokenEnv.status, 'SUCCESS');
    assert.ok(verifyEventHash(tokenEnv));
  });

  it('builds valid envelope for email.dispatched and email.dispatch_failed', () => {
    const dispatchedEnv = buildAuditEnvelope({
      system: 'raronexus',
      category: 'email',
      action: 'email.dispatched',
      severity: 'INFO',
      status: 'SUCCESS',
      actor: { type: 'system', name: 'RaroStock' },
      targets: [{ type: 'application', id: 'app_stock', label: 'RaroStock' }],
      details: { endpoint: 'invoice_ready', recipients: ['cliente@empresa.com'], message_id: 'msg_123' },
    });

    assert.equal(dispatchedEnv.action, 'email.dispatched');
    assert.equal(dispatchedEnv.severity, 'INFO');
    assert.equal(dispatchedEnv.status, 'SUCCESS');
    assert.ok(verifyEventHash(dispatchedEnv));

    const failedEnv = buildAuditEnvelope({
      system: 'raronexus',
      category: 'email',
      action: 'email.dispatch_failed',
      severity: 'CRITICAL',
      status: 'FAILURE',
      actor: { type: 'system', name: 'RaroStock' },
      targets: [{ type: 'application', id: 'app_stock', label: 'RaroStock' }],
      details: { endpoint: 'invoice_ready', error: 'SMTP connection refused', error_code: 'EMAIL_SEND_FAILED' },
    });

    assert.equal(failedEnv.action, 'email.dispatch_failed');
    assert.equal(failedEnv.severity, 'CRITICAL');
    assert.equal(failedEnv.status, 'FAILURE');
    assert.ok(verifyEventHash(failedEnv));
  });

  it('preserves cryptographic hash integrity across JSON serialization roundtrip even with undefined properties', () => {
    const envelope = buildAuditEnvelope({
      system: 'raronexus',
      category: 'email',
      action: 'email.dispatch_failed',
      severity: 'CRITICAL',
      status: 'FAILURE',
      actor: { type: 'system', name: 'RaroStock' },
      targets: [{ type: 'application', id: 'app_stock', label: 'RaroStock' }],
      context: { ip: '127.0.0.1', userAgent: undefined, sessionId: null },
      diff: {
        before: { subject: undefined, status: 'pending' },
        after: { subject: 'Test', status: 'error' },
      },
      details: {
        endpoint: 'send',
        recipients: ['test@raro.io'],
        subject: undefined,
        nested: { inner: undefined, ok: true },
      },
    });

    assert.ok(verifyEventHash(envelope), 'envelope should be valid in memory');

    // Simula trânsito por Redis/QStash e persistência no MongoDB Atlas
    const serialized = JSON.stringify(envelope);
    const deserialized = JSON.parse(serialized);

    assert.ok(
      verifyEventHash(deserialized),
      'envelope must pass cryptographic hash verification after JSON serialization roundtrip'
    );
  });

  it('computes changes with null fallbacks so fields are not lost during JSON roundtrip', () => {
    const envelope = buildAuditEnvelope({
      system: 'raronexus',
      category: 'users',
      action: 'user.profile_updated',
      severity: 'INFO',
      status: 'SUCCESS',
      actor: { type: 'user', userId: 'usr_me', name: 'Rodrigo' },
      targets: [{ type: 'user', id: 'usr_me', label: 'Rodrigo' }],
      diff: {
        before: { nome: 'Old Name', cargo: undefined },
        after: { nome: 'New Name', cargo: 'Engenheiro de Software' },
      },
    });

    assert.ok(envelope.changes);
    const cargoChange = envelope.changes.find(c => c.field === 'cargo');
    assert.ok(cargoChange);
    assert.equal(cargoChange.before, null);
    assert.equal(cargoChange.after, 'Engenheiro de Software');

    const jsonParsed = JSON.parse(JSON.stringify(envelope));
    const cargoChangeAfterRoundtrip = jsonParsed.changes.find((c: any) => c.field === 'cargo');
    assert.equal(cargoChangeAfterRoundtrip.before, null);
    assert.equal(cargoChangeAfterRoundtrip.after, 'Engenheiro de Software');
    assert.ok(verifyEventHash(jsonParsed));
  });

  it('builds valid envelopes for user.invite_resent, user.invite_cancelled, user.registration_completed, and applications', () => {
    const resentEnv = buildAuditEnvelope({
      system: 'raronexus',
      category: 'users',
      action: 'user.invite_resent',
      severity: 'INFO',
      status: 'SUCCESS',
      actor: { type: 'user', userId: 'admin_1', email: 'admin@raro.io', role: 'admin' },
      targets: [{ type: 'invite', id: 'inv_1', label: 'newuser@raro.io' }],
      details: { email: 'newuser@raro.io', expires_at: new Date().toISOString() },
    });
    assert.ok(verifyEventHash(resentEnv));
    assert.ok(verifyEventHash(JSON.parse(JSON.stringify(resentEnv))));

    const cancelledEnv = buildAuditEnvelope({
      system: 'raronexus',
      category: 'users',
      action: 'user.invite_cancelled',
      severity: 'INFO',
      status: 'SUCCESS',
      actor: { type: 'user', userId: 'admin_1', email: 'admin@raro.io', role: 'admin' },
      targets: [{ type: 'invite', id: 'inv_1', label: 'newuser@raro.io' }],
      details: { email: 'newuser@raro.io', status: 'canceled' },
    });
    assert.ok(verifyEventHash(cancelledEnv));
    assert.ok(verifyEventHash(JSON.parse(JSON.stringify(cancelledEnv))));

    const regEnv = buildAuditEnvelope({
      system: 'raronexus',
      category: 'users',
      action: 'user.registration_completed',
      severity: 'INFO',
      status: 'SUCCESS',
      actor: { type: 'user', userId: 'usr_reg', email: 'reg@raro.io', role: 'user' },
      targets: [{ type: 'user', id: 'usr_reg', label: 'Registered User' }],
      details: { email: 'reg@raro.io', nome: 'Registered User' },
    });
    assert.ok(verifyEventHash(regEnv));
    assert.ok(verifyEventHash(JSON.parse(JSON.stringify(regEnv))));

    const assignEnv = buildAuditEnvelope({
      system: 'raronexus',
      category: 'applications',
      action: 'application.assignments_updated',
      severity: 'INFO',
      status: 'SUCCESS',
      actor: { type: 'user', userId: 'admin_1', email: 'admin@raro.io', role: 'admin' },
      targets: [
        { type: 'application', id: 'app_1', label: 'RaroTickets' },
        { type: 'user', id: 'usr_1', label: 'João Silva (joao@raro.io)' },
      ],
      diff: {
        before: { 'João Silva (joao@raro.io)': 'Não autorizado' },
        after: { 'João Silva (joao@raro.io)': 'Organizador' },
      },
      changes: [
        { field: 'João Silva (joao@raro.io)', before: 'Não autorizado', after: 'Organizador' },
      ],
      details: {
        application_id: 'app_1',
        application_name: 'RaroTickets',
        total_assignments: 1,
        changes_count: 1,
        changed_users: [
          {
            user_id: 'usr_1',
            user_name: 'João Silva',
            user_email: 'joao@raro.io',
            previous_role: 'Não autorizado',
            new_role: 'Organizador',
          },
        ],
        assignments: [
          {
            user_id: 'usr_1',
            user_name: 'João Silva',
            user_email: 'joao@raro.io',
            role_id: 'role_org',
            role_key: 'organizador',
            role_name: 'Organizador',
          },
        ],
      },
    });
    assert.ok(assignEnv.diff);
    assert.ok(assignEnv.changes && assignEnv.changes.length === 1);
    assert.equal(assignEnv.changes[0].before, 'Não autorizado');
    assert.equal(assignEnv.changes[0].after, 'Organizador');
    assert.ok(verifyEventHash(assignEnv));
    assert.ok(verifyEventHash(JSON.parse(JSON.stringify(assignEnv))));
  });
});


