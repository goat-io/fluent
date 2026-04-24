/**
 * IANA timezone identifiers for type-safe schedule configuration.
 *
 * This is a curated list of common IANA zones from the tz database
 * (https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).
 * The union includes `string & {}` so arbitrary IANA zones still compile
 * — autocomplete shows the common ones, but you're not locked to them.
 *
 * Usage:
 *   schedule = { cron: '0 9 * * *', timezone: 'America/New_York' }
 */
export type IANATimezone =
  // UTC
  | 'UTC'

  // Americas
  | 'America/New_York'
  | 'America/Chicago'
  | 'America/Denver'
  | 'America/Los_Angeles'
  | 'America/Anchorage'
  | 'America/Toronto'
  | 'America/Vancouver'
  | 'America/Montreal'
  | 'America/Mexico_City'
  | 'America/Bogota'
  | 'America/Lima'
  | 'America/Santiago'
  | 'America/Buenos_Aires'
  | 'America/Sao_Paulo'
  | 'America/Caracas'
  | 'America/Havana'
  | 'America/Phoenix' // no DST
  | 'America/Edmonton'
  | 'America/Winnipeg'
  | 'America/Halifax'
  | 'America/St_Johns'
  | 'America/Costa_Rica'
  | 'America/Guatemala'
  | 'America/Panama'

  // Europe
  | 'Europe/London'
  | 'Europe/Paris'
  | 'Europe/Berlin'
  | 'Europe/Madrid'
  | 'Europe/Rome'
  | 'Europe/Amsterdam'
  | 'Europe/Brussels'
  | 'Europe/Zurich'
  | 'Europe/Vienna'
  | 'Europe/Stockholm'
  | 'Europe/Oslo'
  | 'Europe/Copenhagen'
  | 'Europe/Helsinki'
  | 'Europe/Warsaw'
  | 'Europe/Prague'
  | 'Europe/Budapest'
  | 'Europe/Bucharest'
  | 'Europe/Athens'
  | 'Europe/Istanbul'
  | 'Europe/Moscow'
  | 'Europe/Lisbon'
  | 'Europe/Dublin'
  | 'Europe/Kiev'

  // Asia
  | 'Asia/Tokyo'
  | 'Asia/Shanghai'
  | 'Asia/Hong_Kong'
  | 'Asia/Singapore'
  | 'Asia/Kolkata'
  | 'Asia/Mumbai'
  | 'Asia/Dubai'
  | 'Asia/Riyadh'
  | 'Asia/Tehran'
  | 'Asia/Bangkok'
  | 'Asia/Jakarta'
  | 'Asia/Seoul'
  | 'Asia/Taipei'
  | 'Asia/Manila'
  | 'Asia/Karachi'
  | 'Asia/Dhaka'
  | 'Asia/Colombo'
  | 'Asia/Kuala_Lumpur'
  | 'Asia/Ho_Chi_Minh'
  | 'Asia/Almaty'
  | 'Asia/Tashkent'
  | 'Asia/Tbilisi'
  | 'Asia/Yerevan'
  | 'Asia/Baku'
  | 'Asia/Vladivostok'

  // Africa
  | 'Africa/Cairo'
  | 'Africa/Lagos'
  | 'Africa/Johannesburg'
  | 'Africa/Nairobi'
  | 'Africa/Casablanca'
  | 'Africa/Accra'
  | 'Africa/Addis_Ababa'
  | 'Africa/Dar_es_Salaam'

  // Oceania
  | 'Australia/Sydney'
  | 'Australia/Melbourne'
  | 'Australia/Brisbane' // no DST
  | 'Australia/Perth'
  | 'Australia/Adelaide'
  | 'Australia/Darwin' // no DST
  | 'Pacific/Auckland'
  | 'Pacific/Fiji'
  | 'Pacific/Honolulu'
  | 'Pacific/Guam'

  // Atlantic / Indian
  | 'Atlantic/Reykjavik' // no DST, same as UTC
  | 'Indian/Maldives'
  | 'Indian/Mauritius'

  // Escape hatch: any valid IANA timezone string still compiles
  | (string & {})
