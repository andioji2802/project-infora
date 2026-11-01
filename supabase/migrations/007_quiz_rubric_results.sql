-- INFORA — migration 007: Quiz rubrics and student attempt results

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS max_score NUMERIC(10,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS rubric JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  quiz_owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_nis TEXT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  correct_count INT NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  wrong_count INT NOT NULL DEFAULT 0 CHECK (wrong_count >= 0),
  total_questions INT NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  score NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (score >= 0),
  max_score NUMERIC(10,2) NOT NULL DEFAULT 100 CHECK (max_score > 0),
  rubric_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (quiz_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_owner_quiz ON public.quiz_attempts(quiz_owner_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON public.quiz_attempts(student_name, student_nis);

CREATE TABLE IF NOT EXISTS public.quiz_attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL,
  user_answer JSONB,
  correct_answer JSONB NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  points_possible NUMERIC(10,2) NOT NULL DEFAULT 0,
  points_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  explanation TEXT,
  position INT NOT NULL DEFAULT 1
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher can view own quiz attempts"
ON public.quiz_attempts FOR SELECT
TO authenticated
USING (quiz_owner_id = auth.uid());

CREATE POLICY "Teacher can view own quiz attempt answers"
ON public.quiz_attempt_answers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quiz_attempts a
    WHERE a.id = quiz_attempt_answers.attempt_id
      AND a.quiz_owner_id = auth.uid()
  )
);
