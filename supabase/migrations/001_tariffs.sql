-- Create tariffs table
CREATE TABLE IF NOT EXISTS tariffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handling_company VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    concept VARCHAR(100) NOT NULL,
    price_type VARCHAR(50) NOT NULL,
    min_price DECIMAL(10,2),
    price_per_unit DECIMAL(10,2),
    weight_range_min DECIMAL(10,2),
    weight_range_max DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(handling_company, year, concept, weight_range_min, weight_range_max)
);

-- Create record_expenses table
CREATE TABLE IF NOT EXISTS record_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL,
    concept VARCHAR(200) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    is_manual BOOLEAN DEFAULT false,
    tariff_id UUID REFERENCES tariffs(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tariffs_company_year ON tariffs(handling_company, year);
CREATE INDEX IF NOT EXISTS idx_expenses_record ON record_expenses(record_id);
