import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useConfig } from '../hooks/useConfig'

export default function PrivacidadPage() {
  const navigate = useNavigate()
  const config = useConfig()

  const nombreResponsable = config?.nombreResponsable ?? 'Juan Carlos Pinzón Zamudio'
  const emailResponsable  = config?.emailResponsable  ?? 'juancpinzonz@gmail.com'

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <header className="bg-[#1e3a5f] text-white px-4 py-4 sticky top-0 z-10 shadow">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-bold text-base leading-tight">Política de Privacidad</h1>
            <p className="text-white/60 text-xs">POS Tienda de Barrio</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-7 text-sm leading-relaxed">
        <p className="text-gray-500 text-xs">Última actualización: junio de 2026</p>

        <section>
          <h2 className="font-bold text-base mb-2">1. Responsable del tratamiento</h2>
          <p>
            El responsable del tratamiento de los datos personales es <strong>{nombreResponsable}</strong>,
            operador de POS Tienda de Barrio.
          </p>
          <p className="mt-2">
            Correo de contacto:{' '}
            <a href={`mailto:${emailResponsable}`} className="text-[#1e3a5f] underline">
              {emailResponsable}
            </a>
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">2. Datos que recopilamos</h2>
          <p className="mb-2"><strong>Al registrarse en la plataforma:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nombre completo</li>
            <li>Correo electrónico</li>
            <li>Nombre de la tienda, dirección, teléfono y NIT (opcionales)</li>
          </ul>
          <p className="mt-3 mb-2"><strong>Durante el uso del sistema (datos de terceros):</strong></p>
          <p>
            El módulo de fiados permite al tendero registrar nombres y teléfonos de sus clientes.
            Estos datos son ingresados por el tendero y pertenecen a terceros. El tendero, al usar
            esta funcionalidad, actúa como responsable del tratamiento de esos datos y es quien
            debe informar a sus clientes sobre dicho tratamiento.
          </p>
          <p className="mt-3 mb-2"><strong>Datos generados automáticamente:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Registros de actividad del sistema (logs técnicos, sin información personal)</li>
            <li>Datos de uso para mejorar el servicio (aggregados y anónimos)</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">3. Finalidad del tratamiento</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Proveer y mantener el servicio de punto de venta</li>
            <li>Sincronización de datos entre dispositivos del mismo usuario</li>
            <li>Envío de notificaciones del sistema (alertas de stock, recordatorios de caja)</li>
            <li>Soporte técnico y atención al usuario</li>
            <li>Mejora del servicio mediante datos agregados y anónimos</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">4. Encargados del tratamiento (terceros)</h2>
          <p className="mb-3">Compartimos datos con los siguientes proveedores de servicios tecnológicos:</p>
          <div className="space-y-3">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="font-semibold">Supabase Inc.</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Almacenamiento de datos y autenticación. Los datos se alojan en servidores de AWS
                en la región US-East-1 (Estados Unidos). Política de privacidad: supabase.com/privacy
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="font-semibold">Anthropic, PBC</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Procesamiento de inteligencia artificial para el Asistente de Ventas y el análisis
                de facturas por OCR. Solo se activan cuando el usuario usa estas funciones.
                Política: anthropic.com/privacy
              </p>
            </div>
          </div>
          <p className="mt-3 text-gray-500 text-xs">
            No vendemos ni cedemos datos personales a terceros con fines comerciales.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">5. Tiempo de conservación</h2>
          <p>
            Los datos se conservan mientras la cuenta esté activa. Tras eliminar la cuenta,
            los datos se eliminan definitivamente de los servidores en un plazo máximo de 30 días,
            salvo obligación legal de conservación.
          </p>
          <p className="mt-2">
            Los datos almacenados localmente en el dispositivo (IndexedDB) permanecen en el
            dispositivo del usuario hasta que este los elimine manualmente o desinstale la aplicación.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">6. Derechos del titular</h2>
          <p className="mb-2">De acuerdo con la Ley 1581 de 2012 (Habeas Data), usted tiene derecho a:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Conocer</strong> los datos personales que tenemos sobre usted</li>
            <li><strong>Actualizar</strong> o corregir sus datos</li>
            <li><strong>Suprimir</strong> sus datos (derecho al olvido)</li>
            <li><strong>Revocar</strong> la autorización de tratamiento</li>
            <li><strong>Presentar quejas</strong> ante la Superintendencia de Industria y Comercio</li>
          </ul>
          <p className="mt-3">
            Para ejercer cualquiera de estos derechos, escríbanos a{' '}
            <a href={`mailto:${emailResponsable}`} className="text-[#1e3a5f] underline">
              {emailResponsable}
            </a>{' '}
            indicando su solicitud. Respondemos en un plazo máximo de 10 días hábiles.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">7. Seguridad</h2>
          <p>
            Implementamos medidas técnicas y organizativas para proteger sus datos: cifrado en
            tránsito (HTTPS/TLS), aislamiento de datos por tienda mediante Row Level Security en
            la base de datos, y autenticación segura mediante Supabase Auth.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">8. Quejas ante la SIC</h2>
          <p>
            Si considera que su derecho al Habeas Data ha sido vulnerado, puede presentar una
            queja ante la Superintendencia de Industria y Comercio (SIC):
          </p>
          <p className="mt-1">
            <span className="font-medium">Sitio web:</span> www.sic.gov.co
          </p>
          <p>
            <span className="font-medium">Línea nacional:</span> 01 8000 910 165
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">9. Actualizaciones a esta política</h2>
          <p>
            Podemos actualizar esta política ocasionalmente. Cuando lo hagamos, actualizaremos la
            fecha al inicio del documento y, si los cambios son significativos, lo notificaremos
            dentro de la aplicación.
          </p>
        </section>

        <div className="border-t border-gray-200 dark:border-gray-800 pt-4 text-center text-xs text-gray-400">
          <p>POS Tienda de Barrio · Bogotá, Colombia</p>
          <p className="mt-1">
            <button type="button" onClick={() => navigate('/terms')} className="underline hover:text-gray-600">
              Ver Términos y Condiciones
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}
