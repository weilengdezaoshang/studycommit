CREATE TABLE paper_additions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), paper_id uuid NOT NULL REFERENCES papers(id),
 kind text NOT NULL CHECK (kind IN ('understanding','application')),
 content text NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 20000), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX paper_additions_owner_paper ON paper_additions(user_id,paper_id,created_at);
CREATE TABLE paper_relations (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), paper_a uuid NOT NULL REFERENCES papers(id), paper_b uuid NOT NULL REFERENCES papers(id),
 reason text NOT NULL DEFAULT '' CHECK (length(reason)<=2000), version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
 CHECK (paper_a < paper_b), UNIQUE(user_id,paper_a,paper_b)
);
