import dayjs from 'dayjs'
import Utilities from '../../utilities'

// import 'moment/min/locales';

const Moment = class {
  static setLocales() {
    dayjs.locale(Moment.getLanguage())
  }
  static changeLanguage(code) {
    dayjs.locale(code)
  }

  static getLanguage() {
    return Utilities.getLanguage()
  }
}

export default Moment
