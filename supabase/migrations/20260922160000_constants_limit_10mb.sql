-- Aumenta o limite de arquivo do bucket constants para 15 MB (suportando JSON bruto de até 10 MB)
update storage.buckets
set file_size_limit = 15728640
where id = 'constants';
