import { MenuItem } from './menu.model';

export const MENU: MenuItem[] = [
  {
    id: 1,
    label: 'MENUITEMS.DASHBOARD.TEXT',
    icon: 'src/assets/images/sidebar-icon/icon-home-dark.svg',
    iconDark: 'src/assets/images/sidebar-icon/icon-home-light.svg',
    iconActive: 'src/assets/images/sidebar-icon/icon-home-default.svg',
    link: '/'
  },
  {
    id: 2,
    label: 'Agents',
    icon: 'src/assets/images/sidebar-icon/icon-agent-dark.svg',
    iconDark: 'src/assets/images/sidebar-icon/icon-agent-light.svg',
    iconActive: 'src/assets/images/sidebar-icon/icon-agent-default.svg',
    link: '/agent'
  },
  {
    id: 3,
    label: 'MENUITEMS.BATCHCALL.TEXT',
    icon: 'src/assets/images/sidebar-icon/icon-batch-call-dark.svg',
    iconDark: 'src/assets/images/sidebar-icon/icon-batch-call-light.svg',
    iconActive: 'src/assets/images/sidebar-icon/icon-batch-call-default.svg',
    link: '/batch-call'
  },
  {
    id: 4,
    label: 'MENUITEMS.USER.TEXT',
    icon: 'src/assets/images/sidebar-icon/icon-users-dark.svg',
    iconDark: 'src/assets/images/sidebar-icon/icon-users-light.svg',
    iconActive: 'src/assets/images/sidebar-icon/icon-users-default.svg',
    link: '/user',
    isAdmin: true
  },
  {
    id: 5,
    label: 'API Keys',
    icon: 'src/assets/images/sidebar-icon/icon-api-key-dark.svg',
    iconDark: 'src/assets/images/sidebar-icon/icon-api-key-light.svg',
    iconActive: 'src/assets/images/sidebar-icon/icon-api-key-default.svg',
    link: '/signature-key',
    isAdmin: true,
    sheetConfig: true
  },
  {
    id: 6,
    label: 'Company',
    icon: 'src/assets/images/sidebar-icon/icon-company-dark.svg',
    iconDark: 'src/assets/images/sidebar-icon/icon-company-light.svg',
    iconActive: 'src/assets/images/sidebar-icon/icon-company-default.svg',
    link: '/company',
    isSuperAdmin: true,
    isAdmin: true
  },
  {
    id: 7,
    label: 'Blacklist Number',
    icon: 'src/assets/images/sidebar-icon/icon-blacklist-dark.svg',
    iconDark: 'src/assets/images/sidebar-icon/icon-blacklist-light.svg',
    iconActive: 'src/assets/images/sidebar-icon/icon-blacklist-default.svg',
    link: '/blacklisted-numbers',
    isAdmin: true
  },
  {
    id: 8,
    label: 'MENUITEMS.CONTACT.TEXT',
    icon: 'src/assets/images/sidebar-icon/icon-contact-dark.svg',
    iconDark: 'src/assets/images/sidebar-icon/icon-contact-light.svg',
    iconActive: 'src/assets/images/sidebar-icon/icon-contact-default.svg',
    link: '/contact'
  },
  // {
  //   id: 9,
  //   label: 'MENUITEMS.TEMPLATE.TEXT',
  //   icon: 'src/assets/images/sidebar-icon/icon-users-dark.svg',
  //   iconDark: 'src/assets/images/sidebar-icon/icon-users-light.svg',
  //   iconActive: 'src/assets/images/sidebar-icon/icon-users-default.svg',
  //   link: '/template',
  //   isAdmin: true
  // },
  {
    id: 10,
    label: 'MENUITEMS.PHONE_NUMBER.TEXT',
    icon: 'src/assets/images/sidebar-icon/icon-users-dark.svg',
    iconDark: 'src/assets/images/sidebar-icon/icon-users-light.svg',
    iconActive: 'src/assets/images/sidebar-icon/icon-users-default.svg',
    link: '/phone-number',
    isAdmin: true,
    isSuperAdmin: true
  }
];
