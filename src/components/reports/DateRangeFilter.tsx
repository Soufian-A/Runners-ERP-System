import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, RefreshCw } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, subMonths } from 'date-fns';

interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onRefresh: () => void;
}

export const DateRangeFilter = ({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onRefresh,
}: DateRangeFilterProps) => {
  const handlePresetChange = (preset: string) => {
    const today = new Date();
    
    switch (preset) {
      case 'today':
        onDateFromChange(format(today, 'yyyy-MM-dd'));
        onDateToChange(format(today, 'yyyy-MM-dd'));
        break;
      case 'yesterday':
        const yesterday = subDays(today, 1);
        onDateFromChange(format(yesterday, 'yyyy-MM-dd'));
        onDateToChange(format(yesterday, 'yyyy-MM-dd'));
        break;
      case 'last7':
        onDateFromChange(format(subDays(today, 6), 'yyyy-MM-dd'));
        onDateToChange(format(today, 'yyyy-MM-dd'));
        break;
      case 'last30':
        onDateFromChange(format(subDays(today, 29), 'yyyy-MM-dd'));
        onDateToChange(format(today, 'yyyy-MM-dd'));
        break;
      case 'thisWeek':
        onDateFromChange(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        onDateToChange(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'thisMonth':
        onDateFromChange(format(startOfMonth(today), 'yyyy-MM-dd'));
        onDateToChange(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        onDateFromChange(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
        onDateToChange(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
        break;
      case 'thisYear':
        onDateFromChange(format(startOfYear(today), 'yyyy-MM-dd'));
        onDateToChange(format(today, 'yyyy-MM-dd'));
        break;
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg">
      <div className="space-y-2">
        <Label className="text-sm">Quick Select</Label>
        <Select onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Choose..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="last7">Last 7 Days</SelectItem>
            <SelectItem value="last30">Last 30 Days</SelectItem>
            <SelectItem value="thisWeek">This Week</SelectItem>
            <SelectItem value="thisMonth">This Month</SelectItem>
            <SelectItem value="lastMonth">Last Month</SelectItem>
            <SelectItem value="thisYear">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="date-from" className="text-sm">From Date</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="pl-9 w-[160px]"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="date-to" className="text-sm">To Date</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="pl-9 w-[160px]"
          />
        </div>
      </div>
      
      <Button variant="outline" size="icon" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
};
