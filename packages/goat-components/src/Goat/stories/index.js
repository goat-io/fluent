import { storiesOf } from '@storybook/vue';
import gDrawer from '../Drawers/Drawer';
import gAppLayout from '../Layouts/Full/App';

storiesOf('Drawer', module).add('as a component', () => ({
  components: { gDrawer, gAppLayout },
  template: `<g-app-layout>
    <template v-slot: drawer>
      <g-drawer></g-drawer>
    </template>

    <template v-slot: footer> </template>
  </g-app-layout>`
}));
