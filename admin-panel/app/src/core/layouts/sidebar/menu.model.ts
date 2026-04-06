export interface MenuItem {
  id?: number;
  label?: any;
  icon?: string;
  iconDark?: string;
  iconActive?: string;
  isCollapsed?: any;
  link?: string;
  subItems?: any;
  isTitle?: boolean;
  badge?: any;
  parentId?: number;
  isLayout?: boolean;
  isAdmin?: boolean;
  sheetConfig?: boolean;
  isSuperAdmin?: boolean;
}
