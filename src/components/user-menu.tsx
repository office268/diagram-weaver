import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, User as UserIcon, CreditCard, Zap, Sun, Moon, ShieldCheck } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCredits } from "@/hooks/use-credits";
import { useTheme } from "@/hooks/use-theme";
import { useSiteTexts } from "@/lib/site-texts-context";
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

export function UserMenu({ user, overrideAvatarUrl }: { user: User; overrideAvatarUrl?: string | null }) {
  const navigate = useNavigate();
  const { balance } = useCredits();
  const { theme, toggle } = useTheme();
  const { isAdmin } = useSiteTexts();
  const isDark = theme === "dark";
  const email = user.email ?? "";
  const avatarUrl =
    overrideAvatarUrl ||
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
          <Link to="/billing">
            <Zap className="ml-2 h-4 w-4 text-amber-500" />
            <span className="flex-1">קרדיטים וחיוב</span>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">{balance}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="ml-2 h-4 w-4" />
            הגדרות
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/pricing">
            <CreditCard className="ml-2 h-4 w-4" />
            מחירים
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggle(); }}>
          {isDark ? <Sun className="ml-2 h-4 w-4" /> : <Moon className="ml-2 h-4 w-4" />}
          {isDark ? "מצב בהיר" : "מצב כהה"}
        </DropdownMenuItem>
        {isAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/signup-requests">
                <ShieldCheck className="ml-2 h-4 w-4" />
                בקשות הרשמה
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
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
