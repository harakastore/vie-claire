import { LayoutDashboard, Receipt, CheckSquare, CreditCard, ListTodo, Target, Shield, Dumbbell, LogOut, Briefcase, User, GraduationCap, Trophy, Sun, Rocket } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard },
  { title: "Dashboard du jour", url: "/journee", icon: Sun },
  { title: "Dépenses & Revenus", url: "/depenses", icon: Receipt },
  { title: "Habitudes", url: "/habitudes", icon: CheckSquare },
  { title: "Crédits", url: "/credits", icon: CreditCard },
  { title: "Engagements", url: "/engagements", icon: ListTodo },
  { title: "Objectifs & Tâches", url: "/objectifs", icon: Target },
  { title: "Cabinet", url: "/cabinet", icon: Briefcase },
  { title: "Business Daily Routine", url: "/business-routine", icon: Rocket },
  { title: "Moi-même", url: "/moi-meme", icon: User },
  { title: "Apprentissage", url: "/apprentissage", icon: GraduationCap },
  { title: "Discipline", url: "/discipline", icon: Shield },
  { title: "Sport & Nutrition", url: "/sport", icon: Dumbbell },
  { title: "Performances Sport", url: "/performances-sport", icon: Trophy },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold tracking-wider uppercase">
            {!collapsed && "Précision"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        {!collapsed && user && (
          <p className="text-xs text-muted-foreground truncate px-2 mb-1">{user.email}</p>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-muted-foreground hover:text-foreground">
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Déconnexion"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
