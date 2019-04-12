import moment from 'moment';
import Utilities from '../../utilities';
// import 'moment/min/locales';

let Moment = class {
  static setLocales () {
    moment.locale(Moment.getLanguage());
  }
  static changeLanguage (code) {
    moment.locale(code);
  }

  static getLanguage () {
    return Utilities.getLanguage();
  }
};

export default Moment;
