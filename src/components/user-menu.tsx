import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initialsFromEmail(email: string | null | undefined): string {
  if (!email) return "?";
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? name[0] ?? "?") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase();
}

export function UserMenu({ user }: { user: User }) {
  const navigate = useNavigate();
  const email = user.email ?? "";
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ||
    (user.user_metadata?.picture as string | undefined) ||
    null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="תפריט משתמש"
        >
          <Avatar className="h-8 w-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={email} /> : null}
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {initialsFromEmail(email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="ml-2 h-4 w-4" />
            הגדרות
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/login", replace: true });
          }}
        >
          <LogOut className="ml-2 h-4 w-4" />
          התנתקות
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
