GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON TABLE public.profiles TO service_role;
GRANT ALL ON TABLE public.app_sessions TO service_role;
GRANT ALL ON TABLE public.materials TO service_role;
GRANT ALL ON TABLE public.questions TO service_role;
GRANT ALL ON TABLE public.quizzes TO service_role;
GRANT ALL ON TABLE public.quiz_questions TO service_role;
GRANT ALL ON TABLE public.material_chunks TO service_role;

ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
