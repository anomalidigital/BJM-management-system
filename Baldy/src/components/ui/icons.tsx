/**
 * Semua ikon aplikasi berasal dari Font Awesome Free (gaya solid).
 * Cari ikon baru di https://fontawesome.com/search?ic=free-collection, lalu
 * daftarkan di sini: `faNamaIkon` -> `export const FaNamaIkon = ikon(faNamaIkon)`.
 *
 * Pemakaian: `<FaPlus size={15} />`. `size` = sisi kotak ikon dalam px,
 * glyph diletakkan di tengah kotak itu, warnanya mengikuti `color` teks.
 */
import type { CSSProperties, ReactElement } from 'react'
import { config, type IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowDown, faArrowLeft, faArrowRight, faArrowsRotate, faArrowTrendDown, faArrowTrendUp, faArrowUp, faBan,
  faBars, faBed, faBuilding, faCalendarDays, faChartLine, faCheck, faCheckDouble, faChevronDown, faChevronLeft,
  faChevronRight, faCircleCheck, faCircleExclamation, faCircleInfo, faCircleNotch, faCircleQuestion,
  faClipboardCheck, faCompass, faDatabase, faDownload, faEllipsis, faEye, faEyeSlash, faFileArrowDown,
  faFileContract, faFileExport, faFileInvoiceDollar, faFileLines, faFlagCheckered, faFloppyDisk, faGasPump,
  faGaugeHigh, faHandHoldingDollar, faHandshake, faHashtag, faImage, faInbox, faKey, faLink, faListCheck,
  faLocationDot, faMagnifyingGlass, faMagnifyingGlassMinus, faMinus, faMugHot, faPaperPlane, faPen, faPercent,
  faPlus, faPrint, faReceipt, faRightFromBracket, faRightToBracket, faRotateLeft, faRoute, faSackDollar,
  faScissors, faScrewdriverWrench, faShieldHalved, faShip, faSort, faTrashCan, faTriangleExclamation, faTruck,
  faTruckFast, faTruckRampBox, faUser, faUserPlus, faUsers, faWallet, faWandMagicSparkles, faWarehouse,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'

// CSS Font Awesome dimuat index.css di layer base, jadi kelas Tailwind tetap bisa menimpanya.
config.autoAddCss = false

export interface IconProps {
  /** Sisi kotak ikon dalam px. */
  size?: number
  className?: string
  style?: CSSProperties
}

export type IconComponent = (props: IconProps) => ReactElement

/** Glyph solid tampak lebih penuh dari ikon garis, jadi diberi sedikit ruang di tiap sisi kotak. */
const RUANG = 0.08

function ikon(def: IconDefinition): IconComponent {
  function Ikon({ size = 16, className, style }: IconProps) {
    const tepi = Math.round(size * RUANG * 10) / 10
    const isi = size - tepi * 2
    return (
      <FontAwesomeIcon
        icon={def}
        className={className}
        style={{ width: isi, height: isi, padding: tepi, boxSizing: 'content-box', ...style }}
      />
    )
  }
  Ikon.displayName = `Fa${def.iconName.replace(/(^|-)(\w)/g, (_, _s, c: string) => c.toUpperCase())}`
  return Ikon
}

export const FaArrowDown = ikon(faArrowDown)
export const FaArrowLeft = ikon(faArrowLeft)
export const FaArrowRight = ikon(faArrowRight)
export const FaArrowsRotate = ikon(faArrowsRotate)
export const FaArrowTrendDown = ikon(faArrowTrendDown)
export const FaArrowTrendUp = ikon(faArrowTrendUp)
export const FaArrowUp = ikon(faArrowUp)
export const FaBan = ikon(faBan)
export const FaBars = ikon(faBars)
export const FaBed = ikon(faBed)
export const FaBuilding = ikon(faBuilding)
export const FaCalendarDays = ikon(faCalendarDays)
export const FaChartLine = ikon(faChartLine)
export const FaCheck = ikon(faCheck)
export const FaCheckDouble = ikon(faCheckDouble)
export const FaChevronDown = ikon(faChevronDown)
export const FaChevronLeft = ikon(faChevronLeft)
export const FaChevronRight = ikon(faChevronRight)
export const FaCircleCheck = ikon(faCircleCheck)
export const FaCircleExclamation = ikon(faCircleExclamation)
export const FaCircleInfo = ikon(faCircleInfo)
export const FaCircleNotch = ikon(faCircleNotch)
export const FaCircleQuestion = ikon(faCircleQuestion)
export const FaClipboardCheck = ikon(faClipboardCheck)
export const FaCompass = ikon(faCompass)
export const FaDatabase = ikon(faDatabase)
export const FaDownload = ikon(faDownload)
export const FaEllipsis = ikon(faEllipsis)
export const FaEye = ikon(faEye)
export const FaEyeSlash = ikon(faEyeSlash)
export const FaFileArrowDown = ikon(faFileArrowDown)
export const FaFileContract = ikon(faFileContract)
export const FaFileExport = ikon(faFileExport)
export const FaFileInvoiceDollar = ikon(faFileInvoiceDollar)
export const FaFileLines = ikon(faFileLines)
export const FaFlagCheckered = ikon(faFlagCheckered)
export const FaFloppyDisk = ikon(faFloppyDisk)
export const FaGasPump = ikon(faGasPump)
export const FaGaugeHigh = ikon(faGaugeHigh)
export const FaHandHoldingDollar = ikon(faHandHoldingDollar)
export const FaHandshake = ikon(faHandshake)
export const FaHashtag = ikon(faHashtag)
export const FaImage = ikon(faImage)
export const FaInbox = ikon(faInbox)
export const FaKey = ikon(faKey)
export const FaLink = ikon(faLink)
export const FaListCheck = ikon(faListCheck)
export const FaLocationDot = ikon(faLocationDot)
export const FaMagnifyingGlass = ikon(faMagnifyingGlass)
export const FaMagnifyingGlassMinus = ikon(faMagnifyingGlassMinus)
export const FaMinus = ikon(faMinus)
export const FaMugHot = ikon(faMugHot)
export const FaPaperPlane = ikon(faPaperPlane)
export const FaPen = ikon(faPen)
export const FaPercent = ikon(faPercent)
export const FaPlus = ikon(faPlus)
export const FaPrint = ikon(faPrint)
export const FaReceipt = ikon(faReceipt)
export const FaRightFromBracket = ikon(faRightFromBracket)
export const FaRightToBracket = ikon(faRightToBracket)
export const FaRotateLeft = ikon(faRotateLeft)
export const FaRoute = ikon(faRoute)
export const FaSackDollar = ikon(faSackDollar)
export const FaScissors = ikon(faScissors)
export const FaScrewdriverWrench = ikon(faScrewdriverWrench)
export const FaShieldHalved = ikon(faShieldHalved)
export const FaShip = ikon(faShip)
export const FaSort = ikon(faSort)
export const FaTrashCan = ikon(faTrashCan)
export const FaTriangleExclamation = ikon(faTriangleExclamation)
export const FaTruck = ikon(faTruck)
export const FaTruckFast = ikon(faTruckFast)
export const FaTruckRampBox = ikon(faTruckRampBox)
export const FaUser = ikon(faUser)
export const FaUserPlus = ikon(faUserPlus)
export const FaUsers = ikon(faUsers)
export const FaWallet = ikon(faWallet)
export const FaWandMagicSparkles = ikon(faWandMagicSparkles)
export const FaWarehouse = ikon(faWarehouse)
export const FaXmark = ikon(faXmark)
