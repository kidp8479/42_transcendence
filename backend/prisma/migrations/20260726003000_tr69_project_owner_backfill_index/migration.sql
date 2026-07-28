-- Projects without any member cannot receive an owner deterministically.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "Project" AS project
		WHERE NOT EXISTS (
			SELECT 1
			FROM "ProjectMember" AS member
			WHERE member."projectId" = project.id
		)
	) THEN
		RAISE EXCEPTION 'Cannot assign an OWNER to a project with no members';
	END IF;
END $$;

-- Backfill
-- Prefer the oldest ADMIN; if none exists, use the oldest member.
WITH ranked_members AS (
	SELECT
		member.id,
		member."projectId",
		ROW_NUMBER() OVER (
			PARTITION BY member."projectId"
			ORDER BY
				CASE WHEN member.role = 'ADMIN' THEN 0 ELSE 1 END,
				member."createdAt" ASC,
				member.id ASC
		) AS rank_in_project
	FROM "ProjectMember" AS member
	WHERE member.role <> 'OWNER'
)
UPDATE "ProjectMember" AS member
SET role = 'OWNER'
FROM ranked_members
WHERE member.id = ranked_members.id
	AND ranked_members.rank_in_project = 1
	AND NOT EXISTS (
		SELECT 1
		FROM "ProjectMember" AS owner
		WHERE owner."projectId" = ranked_members."projectId"
			AND owner.role = 'OWNER'
	);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_owner_unique"
ON "ProjectMember" ("projectId")
WHERE role = 'OWNER';
