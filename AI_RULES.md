# AI Rules for Delivery ERP Application

This document outlines the core technologies used in this project and provides clear guidelines for library usage to maintain consistency, readability, and best practices.

## Tech Stack Overview

*   **Frontend Framework**: React.js
*   **Language**: TypeScript
*   **Build Tool**: Vite
*   **Styling**: Tailwind CSS for all styling and responsive design.
*   **UI Components**: shadcn/ui, built on top of Radix UI primitives.
*   **Icons**: Lucide React for all iconography.
*   **Routing**: React Router DOM for client-side navigation.
*   **Data Fetching & State Management**: React Query for server state management and data fetching.
*   **Form Management**: React Hook Form for form handling, with Zod for schema validation.
*   **Database/Backend**: Supabase for database, authentication, and edge functions.
*   **Date Utilities**: `date-fns` for date manipulation and formatting.
*   **Toast Notifications**: `sonner` for modern, accessible toast notifications.

## Library Usage Rules

To ensure a consistent and maintainable codebase, please adhere to the following rules when developing:

*   **UI Components**:
    *   **Prioritize shadcn/ui**: Always use components from `src/components/ui` (shadcn/ui) first. These components are pre-styled with Tailwind CSS and provide accessibility features.
    *   **Radix UI as Fallback**: If a specific component is not available in `shadcn/ui`, you may use a Radix UI primitive directly, but ensure it is styled with Tailwind CSS to match the existing design system.
    *   **No Custom UI for Existing Components**: Do not create custom versions of components that already exist in `shadcn/ui` or can be easily composed from Radix UI primitives.
*   **Styling**:
    *   **Tailwind CSS Only**: All styling must be done using Tailwind CSS utility classes. Avoid inline styles or separate CSS files unless absolutely necessary for global styles (e.g., `src/index.css`).
    *   **Responsive Design**: Always consider responsiveness and use Tailwind's responsive prefixes (e.g., `md:`, `lg:`) to ensure the application looks good on all screen sizes.
*   **Data Fetching**:
    *   **React Query**: Use `@tanstack/react-query` for all asynchronous data fetching, caching, and synchronization with the server. This includes `useQuery` for fetching data and `useMutation` for data modifications.
    *   **Supabase Client**: Interact with the Supabase backend exclusively through the `supabase` client instance provided in `src/integrations/supabase/client.ts`.
*   **State Management**:
    *   **Local Component State**: For simple, local component state, use React's `useState` hook.
    *   **Global State**: For global or complex application state, consider if React Query can manage it (for server-derived state) or if a simple React Context API solution is more appropriate. Avoid introducing new state management libraries.
*   **Routing**:
    *   **React Router DOM**: Use `react-router-dom` for all navigation within the application.
    *   **Route Definition**: Keep all primary route definitions within `src/App.tsx`.
*   **Form Handling**:
    *   **React Hook Form & Zod**: Use `react-hook-form` for managing form state and submissions. Integrate `zod` for robust schema-based form validation.
*   **Toast Notifications**:
    *   **Sonner**: For displaying user feedback and notifications, use the `sonner` library. Import `toast` from `sonner` directly. The existing `useToast` hook (Radix UI based) is present but `sonner` is preferred for new implementations.
*   **File Structure**:
    *   **Components**: New reusable UI components should be placed in `src/components/` within their own dedicated subfolders if they are complex or have related files (e.g., `src/components/drivers/CreateDriverDialog.tsx`).
    *   **Pages**: Top-level views should reside in `src/pages/`.
    *   **Hooks**: Custom React hooks should be placed in `src/hooks/`.
    *   **Utilities**: Helper functions and utility files should be in `src/lib/` or `src/utils/`.
    *   **Supabase Integration**: All Supabase-related client setup and type definitions are in `src/integrations/supabase/`.
*   **Code Quality**:
    *   **TypeScript**: Always use TypeScript for type safety. Define interfaces or types for complex data structures.
    *   **Readability**: Write clean, well-structured, and self-documenting code.
    *   **Modularity**: Break down complex features into smaller, focused components and functions.