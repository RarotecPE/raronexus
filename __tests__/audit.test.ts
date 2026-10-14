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

