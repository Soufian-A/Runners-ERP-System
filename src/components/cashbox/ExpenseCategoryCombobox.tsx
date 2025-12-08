import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Category {
  id: string;
  name: string;
  category_group: string;
}

interface ExpenseCategoryComboboxProps {
  categories: Category[] | undefined;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ExpenseCategoryCombobox({
  categories,
  value,
  onValueChange,
  placeholder = "Select category...",
  disabled = false,
}: ExpenseCategoryComboboxProps) {
  const [open, setOpen] = useState(false);

  const groupedCategories = useMemo(() => {
    if (!categories) return {};
    return categories.reduce((acc, cat) => {
      if (!acc[cat.category_group]) {
        acc[cat.category_group] = [];
      }
      acc[cat.category_group].push(cat);
      return acc;
    }, {} as Record<string, Category[]>);
  }, [categories]);

  const selectedCategory = categories?.find(c => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedCategory ? (
            <span className="flex items-center gap-2">
              <span>{selectedCategory.name}</span>
              <span className="text-xs text-muted-foreground">({selectedCategory.category_group})</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search categories..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No category found.</CommandEmpty>
            {Object.entries(groupedCategories).map(([group, cats]) => (
              <CommandGroup key={group} heading={group}>
                {cats.map((category) => (
                  <CommandItem
                    key={category.id}
                    value={`${category.name} ${category.category_group}`}
                    onSelect={() => {
                      onValueChange(category.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === category.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {category.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
