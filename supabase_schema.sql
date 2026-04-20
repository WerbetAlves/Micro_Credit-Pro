-- SQL Script to initialize the Emerald Micro-Credit Pro database in Supabase
-- This script uses IF NOT EXISTS to avoid errors if run multiple times.

-- 1. Create Profiles Table (For Users/Lenders)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT false,
    plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'enterprise')),
    business_name TEXT,
    document_id TEXT, -- CPF/CNPJ
    phone TEXT,
    address TEXT,
    payment_methods JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Clients Table (For Borrowers managed by Lenders)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    document_id TEXT, -- CPF/CNPJ
    address TEXT,
    credit_score INT DEFAULT 500,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Loans Table
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    principal_amount DECIMAL(12, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL, 
    term_months INT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'repaid', 'default')),
    monthly_installment DECIMAL(12, 2) NOT NULL,
    total_repayment DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration: Ensure columns exist in all tables
DO $$ 
BEGIN
    -- Client ID in Loans
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='client_id') THEN
        ALTER TABLE public.loans ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
    END IF;
    
    -- Interest Type in Loans (annual or monthly)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='interest_type') THEN
        ALTER TABLE public.loans ADD COLUMN interest_type TEXT DEFAULT 'annual' CHECK (interest_type IN ('annual', 'monthly'));
    END IF;
    
    -- Created At in all tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='created_at') THEN
        ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='created_at') THEN
        ALTER TABLE public.clients ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loans' AND column_name='created_at') THEN
        ALTER TABLE public.loans ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='installments' AND column_name='created_at') THEN
        ALTER TABLE public.installments ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

-- 4. Create Installments Table
CREATE TABLE IF NOT EXISTS public.installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'paid', 'late', 'missed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL CHECK (category IN ('loan_disbursement', 'payment_received', 'fee', 'adjustment', 'other')),
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 7. Policies (Drop if exists to avoid errors on reapplying)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
    DROP POLICY IF EXISTS "Users can insert their own loans" ON public.loans;
    DROP POLICY IF EXISTS "Users can view their own loans" ON public.loans;
    DROP POLICY IF EXISTS "Users can view their own installments" ON public.installments;
    DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
END $$;

CREATE POLICY "Users can manage their own clients" ON clients
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own loans" ON loans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own loans" ON loans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own installments" ON installments
    FOR SELECT USING (
        loan_id IN (SELECT id FROM loans WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can manage their own transactions" ON transactions
    FOR ALL USING (auth.uid() = user_id);
