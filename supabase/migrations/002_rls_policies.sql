-- ====================================================================
-- INFORA — MIGRATION 002: ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Security Policies per Bagian 7
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Table Policies
-- Anyone authenticated can view teacher profiles
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

-- Teachers can only update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 2. Materials Table Policies
-- Anonymous students can read only PUBLISHED materials
CREATE POLICY "Published materials are viewable by everyone" 
ON public.materials FOR SELECT 
USING (status = 'published');

-- Teachers can view their own materials regardless of status (draft/archived)
CREATE POLICY "Teachers can view their own materials" 
ON public.materials FOR SELECT 
TO authenticated 
USING (auth.uid() = owner_id);

-- Teachers can only create materials under their own owner_id
CREATE POLICY "Teachers can insert materials" 
ON public.materials FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = owner_id);

-- Teachers can only update their own materials
CREATE POLICY "Teachers can update their own materials" 
ON public.materials FOR UPDATE 
TO authenticated 
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Teachers can only delete their own materials
CREATE POLICY "Teachers can delete their own materials" 
ON public.materials FOR DELETE 
TO authenticated 
USING (auth.uid() = owner_id);

-- 3. Material Chunks Table Policies (pgvector RAG)
-- Public can only select chunks belonging to published materials
CREATE POLICY "Chunks of published materials viewable" 
ON public.material_chunks FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.materials m 
        WHERE m.id = material_chunks.material_id AND m.status = 'published'
    )
);

-- Edge functions or owners can manage chunks
CREATE POLICY "Teachers manage their material chunks" 
ON public.material_chunks FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.materials m 
        WHERE m.id = material_chunks.material_id AND m.owner_id = auth.uid()
    )
);

-- 4. Questions Table Policies
-- Anonymous students can view published questions WITHOUT leaking correct_answer
CREATE POLICY "Published questions viewable" 
ON public.questions FOR SELECT 
USING (status = 'published');

-- Teachers manage their own questions
CREATE POLICY "Teachers can insert questions" 
ON public.questions FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Teachers can update own questions" 
ON public.questions FOR UPDATE 
TO authenticated 
USING (auth.uid() = owner_id);

CREATE POLICY "Teachers can delete own questions" 
ON public.questions FOR DELETE 
TO authenticated 
USING (auth.uid() = owner_id);

-- 5. Quizzes Table Policies
CREATE POLICY "Published quizzes viewable by everyone" 
ON public.quizzes FOR SELECT 
USING (status = 'published');

CREATE POLICY "Teachers can manage own quizzes" 
ON public.quizzes FOR ALL 
TO authenticated 
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- 6. Quiz Questions Table Policies
CREATE POLICY "Quiz questions viewable for published quizzes" 
ON public.quiz_questions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.quizzes q 
        WHERE q.id = quiz_questions.quiz_id AND q.status = 'published'
    )
);

-- 7. Content Feedback Policies
-- Anyone can insert feedback
CREATE POLICY "Anyone can submit anonymous feedback" 
ON public.content_feedback FOR INSERT 
WITH CHECK (true);
