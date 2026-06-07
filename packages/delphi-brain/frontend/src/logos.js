// Import all logos so Vite can inline them into the single-file build
import haproxy from './logos/haproxy.svg'
import emqx from './logos/emqx.svg'
import strimzi from './logos/strimzi.svg'
import kafka from './logos/kafka.svg'
import msk from './logos/msk.svg'
import go from './logos/go.svg'
import fiber from './logos/fiber.svg'
import pgbouncer from './logos/pgbouncer.svg'
import cnpg from './logos/cnpg.svg'
import postgresql from './logos/postgresql.svg'
import rdsProxy from './logos/rds-proxy.svg'
import auroraGlobal from './logos/aurora-global.svg'
import minio from './logos/minio.svg'
import s3 from './logos/s3.svg'
import mender from './logos/mender.ico'
import platform from './logos/platform.svg'
import notification from './logos/notification.svg'
import prometheus from './logos/prometheus.svg'
import loki from './logos/loki.svg'
import grafana from './logos/grafana.svg'
import aws from './logos/aws.svg'
import route53 from './logos/route53.svg'
import globalAccelerator from './logos/global-accelerator.svg'
import nlb from './logos/nlb.svg'
import eks from './logos/eks.svg'
import cloudwatch from './logos/cloudwatch.svg'
import aurora from './logos/aurora.svg'
import kms from './logos/kms.svg'
import regionSecondary from './logos/region-secondary.svg'

// Map from public path to imported URL (works in both dev and single-file build)
export const logoMap = {
  '/logos/haproxy.svg': haproxy,
  '/logos/emqx.svg': emqx,
  '/logos/strimzi.svg': strimzi,
  '/logos/kafka.svg': kafka,
  '/logos/msk.svg': msk,
  '/logos/go.svg': go,
  '/logos/fiber.svg': fiber,
  '/logos/pgbouncer.svg': pgbouncer,
  '/logos/cnpg.svg': cnpg,
  '/logos/postgresql.svg': postgresql,
  '/logos/rds-proxy.svg': rdsProxy,
  '/logos/aurora-global.svg': auroraGlobal,
  '/logos/minio.svg': minio,
  '/logos/s3.svg': s3,
  '/logos/mender.ico': mender,
  '/logos/platform.svg': platform,
  '/logos/notification.svg': notification,
  '/logos/prometheus.svg': prometheus,
  '/logos/loki.svg': loki,
  '/logos/grafana.svg': grafana,
  '/logos/aws.svg': aws,
  '/logos/route53.svg': route53,
  '/logos/global-accelerator.svg': globalAccelerator,
  '/logos/nlb.svg': nlb,
  '/logos/eks.svg': eks,
  '/logos/cloudwatch.svg': cloudwatch,
  '/logos/aurora.svg': aurora,
  '/logos/kms.svg': kms,
  '/logos/region-secondary.svg': regionSecondary,
}

// Resolve a /logos/xxx path to the actual URL (inlined in single-file mode)
export function resolveLogo(path) {
  return logoMap[path] || path
}
