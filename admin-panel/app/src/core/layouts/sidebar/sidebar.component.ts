import { Component, OnInit, EventEmitter, Output, ViewChild, ElementRef } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { MENU } from './menu';
import { MenuItem } from './menu.model';
import { environment } from 'app/src/environments/environment';
import { LanguageService } from '../../../shared/services/language.service';
import { AuthService } from 'app/src/shared/services/auth/auth-service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
  mode: string | undefined;
  currentLang: string = 'en';
  isSidebarExtended = false;
  isDarked = false;
  currentUser: any;

  menu: any;
  toggle: any = true;
  menuItems: MenuItem[] = [];
  @ViewChild('sideMenu') sideMenu!: ElementRef;
  @Output() mobileMenuButtonClicked = new EventEmitter();

  constructor(
    private router: Router,
    private languageService: LanguageService,
    private authService: AuthService,
    public translate: TranslateService
  ) {
    this.currentLang = this.languageService.getStoredLanguage();
  }

  ngOnInit(): void {
    this.mode = localStorage.getItem('theme') || 'light';
    this.authService.currentUser$.subscribe((user: any) => {
      this.currentUser = user;
      this.menuItems = MENU.filter((menuItem) => {
        return !menuItem.isAdmin || this.currentUser?.user?.isAdmin;
      })
        .filter((menuItem) => {
          return !menuItem.sheetConfig || this.currentUser?.user?.sheetConfig;
        })
        .filter((menuItem) => {
          return !menuItem.isSuperAdmin || this.currentUser?.user?.isSuperAdmin;
        });
    });

    if (this.mode === 'dark') {
      this.isDarked = true;
      this.changeMode(true);
    } else {
      this.isDarked = false;
      this.changeMode(false);
    }

    this.router.events.subscribe((event) => {
      if (document.documentElement.getAttribute('data-layout') != 'twocolumn') {
        if (event instanceof NavigationEnd) {
          this.initActiveMenu();
        }
      }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initActiveMenu();
    }, 0);
  }

  // Add the toggleSidebar function
  toggleSidebar() {
    this.isSidebarExtended = !this.isSidebarExtended;

    if (this.isSidebarExtended) {
      document.documentElement.setAttribute('data-sidebar-size', 'sm');
      document.querySelector('div.app-menu')?.classList.add('extended');
      document.querySelector('div.app-menu')?.classList.remove('not-extended');
    } else {
      document.documentElement.setAttribute('data-sidebar-size', 'lg');
      document.querySelector('div.app-menu')?.classList.remove('extended');
      document.querySelector('div.app-menu')?.classList.add('not-extended');
    }
  }

  /**
   * Simplified icon styles - let CSS handle the colors
   */
  getIconStyles(item: MenuItem, isActive: boolean = false): any {
    return {
      transition: 'filter 0.3s ease, transform 0.2s ease'
    };
  }

  isRouteActive(route: any): boolean {
    if (!route) return false;

    const currentPath = this.router.url.split('?')[0].replace('/admin', '');
    const routePath = route.replace('/admin', '') || route;

    if (currentPath === routePath) {
      return true;
    }
    if (currentPath.startsWith(routePath + '/')) {
      return true;
    }

    return false;
  }

  isMenuItemActive(item: MenuItem): boolean {
    if (!item.link) return false;

    if (this.isRouteActive(item.link)) {
      return true;
    }

    if (item.subItems && item.subItems.length > 0) {
      return item.subItems.some((subItem: MenuItem) => this.isMenuItemActive(subItem));
    }

    return false;
  }

  removeActivation(items: any) {
    items.forEach((item: any) => {
      item.classList.remove('active');
      const parentLi = item.closest('li');
      if (parentLi) {
        parentLi.classList.remove('active');
      }
    });
  }

  toggleItem(item: any) {
    if (this.isSidebarExtended && this.hasItems(item)) {
      return;
    }

    // Prevent navigation if already on this route
    if (item.link && !this.hasItems(item) && this.isRouteActive(item.link)) {
      return;
    }

    if (item.link && !this.hasItems(item)) {
      this.router.navigate([item.link]);
      return;
    }

    item.isCollapsed = !item.isCollapsed;
    if (!item.isCollapsed) {
      this.menuItems.forEach((menuItem: any) => {
        if (menuItem !== item && menuItem.subItems && menuItem !== item.parent) {
          if (menuItem.isCollapsed === false) {
            menuItem.isCollapsed = true;
          }
        }

        if (menuItem.subItems) {
          menuItem.subItems.forEach((subItem: any) => {
            if (subItem !== item && subItem !== item.parent && subItem.subItems) {
              if (subItem.isCollapsed === false) {
                subItem.isCollapsed = true;
              }
            }

            if (subItem.subItems) {
              subItem.subItems.forEach((childItem: any) => {
                if (childItem !== item && childItem !== item.parent) {
                  if (childItem.isCollapsed === false) {
                    childItem.isCollapsed = true;
                  }
                }
              });
            }
          });
        }
      });
    }

    if (this.hasItems(item)) {
      if (item.subItems) {
        item.subItems.forEach((subItem: any) => {
          subItem.parent = item;
        });
      }
    }
  }

  activateParentDropdown(item: any) {
    item.classList.add('active');

    let current = item.closest('.collapse.menu-dropdown');
    while (current) {
      const parentToggle = current.previousElementSibling;
      if (parentToggle && parentToggle.classList.contains('nav-link')) {
        parentToggle.classList.add('active');
      }

      const parentLi = current.closest('li');
      if (parentLi) {
        parentLi.classList.add('active');
      }

      current = current.parentElement?.closest('.collapse.menu-dropdown');
    }
  }

  updateActive(event: any) {
    const ul = document.getElementById('navbar-nav');
    if (ul) {
      const items = Array.from(ul.querySelectorAll('a.nav-link'));
      this.removeActivation(items);
    }
    this.activateParentDropdown(event.target);

    setTimeout(() => {}, 0);
  }

  initActiveMenu() {
    const currentPath = environment.production
      ? window.location.pathname.replace('/velzon/angular/default', '')
      : this.router.url.split('?')[0];

    const path = this.findMenuItem(currentPath, this.menuItems);

    if (path) {
      for (const item of path) {
        item.isCollapsed = false;
      }
    }

    const ul = document.getElementById('navbar-nav');
    if (ul) {
      const items = Array.from(ul.querySelectorAll('a.nav-link'));
      const activeItems = items.filter((x: any) => x.classList.contains('active'));
      this.removeActivation(activeItems);

      const matchingMenuItem = items.find((x: any) => {
        let path = x.pathname;
        if (environment.production) {
          path = path.replace('/velzon/angular/default', '');
        }
        return path === currentPath;
      });

      if (matchingMenuItem) {
        this.activateParentDropdown(matchingMenuItem);
      }
    }
  }

  private findMenuItem(pathname: string, menuItems: any[], parents: any[] = []): any {
    for (const menuItem of menuItems) {
      const currentPath = [...parents, menuItem];
      if (menuItem.link && menuItem.link === pathname) {
        return currentPath;
      }

      if (menuItem.subItems) {
        const foundItem = this.findMenuItem(pathname, menuItem.subItems, currentPath);
        if (foundItem) {
          return foundItem;
        }
      }
    }

    return null;
  }

  hasItems(item: MenuItem) {
    return item.subItems !== undefined ? item.subItems.length > 0 : false;
  }

  toggleMobileMenu(event: any) {
    var sidebarsize = document.documentElement.getAttribute('data-sidebar-size');
    if (sidebarsize == 'sm-hover-active') {
      document.documentElement.setAttribute('data-sidebar-size', 'sm-hover');
    } else {
      document.documentElement.setAttribute('data-sidebar-size', 'sm-hover-active');
    }
  }

  SidebarHide() {
    document.body.classList.remove('vertical-sidebar-enable');
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/auth/login']);
  }

  switchLanguage(lang: string): void {
    this.currentLang = lang;
    this.translate.setDefaultLang(lang);
    this.languageService.setLanguage(this.currentLang);
  }

  changeMode(event: any) {
    this.isDarked = event;
    let mode: string;
    if (this.isDarked) {
      mode = 'dark';
    } else {
      mode = 'light';
    }

    this.mode = mode;
    localStorage.setItem('theme', mode);
    document.documentElement.setAttribute('data-bs-theme', mode);

    // Force a re-render of icons to apply new theme
    setTimeout(() => {
      const allIcons = document.querySelectorAll('.icon');
      allIcons.forEach((icon) => {
        // Trigger a repaint by slightly modifying and resetting transform
        (icon as HTMLElement).style.transform = 'scale(0.99)';
        setTimeout(() => {
          (icon as HTMLElement).style.transform = '';
        }, 10);
      });
    }, 50);
  }

  getIconSrc(item: any): string {
    const isActive = this.isRouteActive(item.link);
    if (isActive) {
      return item?.iconActive;
    } else if (this.isDarked) {
      return item?.iconDark;
    } else {
      return item?.icon;
    }
  }

  getUserInitials(
    firstName: string | null | undefined,
    lastName: string | null | undefined
  ): string {
    const firstInitial = firstName?.charAt(0)?.toUpperCase() || '';
    const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';
    return firstInitial + lastInitial;
  }

  isActive(path: any) {
    return this.isRouteActive(path);
  }

  getFullPath(path: any) {
    return path;
  }
}
