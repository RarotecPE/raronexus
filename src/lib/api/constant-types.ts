export type ApiConstantRow = {
  id: string;
  name: string;
  is_public: boolean;
  current_version: number;
  storage_path: string;
  content_hash: string;
  original_size: number;
  compressed_size: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiConstantVersionRow = {
  id: string;
  constant_id: string;
  version: number;
  storage_path: string;
  content_hash: string;
  original_size: number;
  compressed_size: number;
  created_by: string | null;
  expires_at: string | null;
  created_at: string;
};

export type ApiConstantSummary = {
  id: string;
  name: string;
  is_public: boolean;
  current_version: number;
  content_hash: string;
  original_size: number;
  compressed_size: number;
  created_at: string;
  updated_at: string;
};

export type ApiConstantDetail = ApiConstantSummary & {
  content: string;
};
