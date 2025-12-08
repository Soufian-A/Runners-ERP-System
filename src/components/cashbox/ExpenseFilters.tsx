import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, Filter } from 'lucide-react';
import ExpenseCategoryCombobox from './ExpenseCategoryCombobox';

export interface ExpenseFiltersState {
  search: string;
  categoryId: string;
  categoryGroup: string;
  dateFrom: string;
  dateTo: string;
  currency: string;
  minAmount: string;
  maxAmount: string;
}

interface ExpenseFiltersProps {
  filters: ExpenseFiltersState;
  onFiltersChange: (filters: ExpenseFiltersState) => void;
  onClear: () => void;
}

export default function ExpenseFilters({ filters, onFiltersChange, onClear }: ExpenseFiltersProps) {
  const { data: categories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('category_group', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const categoryGroups = [...new Set(categories?.map(c => c.category_group) || [])];

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4 mr-1" />
            Clear All
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div className="space-y-2">
          <Label className="text-xs">Search Notes</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in notes..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-9"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label className="text-xs">Category</Label>
          <ExpenseCategoryCombobox
            categories={categories}
            value={filters.categoryId}
            onValueChange={(value) => onFiltersChange({ ...filters, categoryId: value })}
            placeholder="All categories"
          />
        </div>

        {/* Category Group */}
        <div className="space-y-2">
          <Label className="text-xs">Category Group</Label>
          <Select
            value={filters.categoryGroup}
            onValueChange={(value) => onFiltersChange({ ...filters, categoryGroup: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All groups" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Groups</SelectItem>
              {categoryGroups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Currency */}
        <div className="space-y-2">
          <Label className="text-xs">Currency</Label>
          <Select
            value={filters.currency}
            onValueChange={(value) => onFiltersChange({ ...filters, currency: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All currencies" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Currencies</SelectItem>
              <SelectItem value="USD">USD Only</SelectItem>
              <SelectItem value="LBP">LBP Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date From */}
        <div className="space-y-2">
          <Label className="text-xs">Date From</Label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
          />
        </div>

        {/* Date To */}
        <div className="space-y-2">
          <Label className="text-xs">Date To</Label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
          />
        </div>

        {/* Min Amount */}
        <div className="space-y-2">
          <Label className="text-xs">Min Amount</Label>
          <Input
            type="number"
            placeholder="0"
            value={filters.minAmount}
            onChange={(e) => onFiltersChange({ ...filters, minAmount: e.target.value })}
          />
        </div>

        {/* Max Amount */}
        <div className="space-y-2">
          <Label className="text-xs">Max Amount</Label>
          <Input
            type="number"
            placeholder="∞"
            value={filters.maxAmount}
            onChange={(e) => onFiltersChange({ ...filters, maxAmount: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
