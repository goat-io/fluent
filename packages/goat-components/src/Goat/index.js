import Vue from "vue";
import gHeader from "./Headers/Header";
import gHeaderAction from "./Headers/Action";
import gHeaderMenu from "./Headers/DropMenu/Menu";
import gHeaderMenuItem from "./Headers/DropMenu/Item";
import gHeaderQuickAction from "./Headers/QuickAction/QuickAction";
import gDrawer from "./Drawers/Drawer";
import gDrawerHeader from "./Drawers/Headers/Header";
import gDrawerVersion from "./Drawers/Headers/Version";
import gDrawerLink from "./Drawers/Link";
import gPillButton from "./Buttons/PillButton";
import gBreadcrumb from "./Breadcrumb/Breadcrumb";
import gDrawerPageLinks from "./Drawers/DrawerPageLinks/DrawerPageLinks";
import gPageLayoutFull from "./Layouts/Page/Full";
import gAppLayout from "./Layouts/Full/App";
import gDataTable from "./DataTable/Table";
import gPortlet from "./Portlets/Portlet";
import Error from "./Alert/Error";
import Success from "./Alert/Success";

const Components = {
  Error,
  Success,
  gBreadcrumb,
  gDrawerPageLinks,
  gDrawer,
  gDrawerHeader,
  gDrawerVersion,
  gDrawerLink,
  gPageLayoutFull,
  gAppLayout,
  gHeader,
  gHeaderAction,
  gHeaderMenu,
  gHeaderMenuItem,
  gHeaderQuickAction,
  gPillButton,
  gDataTable,
  gPortlet
};

Object.keys(Components).forEach(name => {
  Vue.component(name, Components[name]);
});

export default Components;
