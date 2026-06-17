import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function TerminosPage() {
  const navigate = useNavigate()

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
            <h1 className="font-bold text-base leading-tight">Términos y Condiciones</h1>
            <p className="text-white/60 text-xs">POS Tienda de Barrio</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-7 text-sm leading-relaxed">
        <p className="text-gray-500 text-xs">Última actualización: junio de 2026</p>

        <p>
          Al usar POS Tienda de Barrio, usted acepta estos términos y condiciones. Si no está
          de acuerdo, no utilice el servicio.
        </p>

        <section>
          <h2 className="font-bold text-base mb-2">1. Descripción del servicio</h2>
          <p>
            POS Tienda de Barrio es una aplicación de punto de venta (POS) diseñada para tiendas
            de barrio colombianas. Funciona como aplicación web progresiva (PWA) y aplicación
            Android, con capacidad de operar sin conexión a internet.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">2. Licencia de uso</h2>
          <p>
            Le otorgamos una licencia no exclusiva, intransferible y revocable para usar el
            software en su(s) tienda(s). Está prohibido:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Revender o sublicenciar el software a terceros</li>
            <li>Copiar, modificar o crear trabajos derivados del software</li>
            <li>Usar el servicio para fines ilegales o no autorizados</li>
            <li>Intentar eludir los mecanismos de activación o seguridad</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">3. Planes y precios</h2>
          <div className="space-y-3">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="font-semibold">Plan Demo — Gratuito</p>
              <p className="text-gray-500 text-xs mt-1">
                Acceso a todas las funcionalidades básicas hasta 50 ventas. No requiere pago ni
                código de activación.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="font-semibold">Plan Básico — $500.000 COP · Pago único</p>
              <p className="text-gray-500 text-xs mt-1">
                Ventas ilimitadas, todas las funcionalidades del plan básico. Código de activación
                requerido.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="font-semibold">Plan Pro — $900.000 COP · Pago único</p>
              <p className="text-gray-500 text-xs mt-1">
                Todo lo del Plan Básico más módulo de domicilios, catálogo público y análisis de
                facturas por OCR.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <p className="font-semibold">Upgrade Básico → Pro — $450.000 COP · Pago único</p>
              <p className="text-gray-500 text-xs mt-1">
                Para tiendas que ya tienen el Plan Básico activo y desean acceder a las funciones Pro.
              </p>
            </div>
          </div>
          <p className="mt-3 text-gray-500 text-xs">
            Los precios están en pesos colombianos (COP) e incluyen todas las actualizaciones
            futuras del plan adquirido sin costo adicional.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">4. Política de reembolso</h2>
          <p>
            Los códigos de activación son de <strong>uso único y no reembolsables</strong> una vez
            activados. Antes de activar cualquier plan, puede probar el sistema completo con el
            Plan Demo (50 ventas sin límite de tiempo ni funciones).
          </p>
          <p className="mt-2">
            Si tiene un problema técnico con la activación, contáctenos a{' '}
            <a href="mailto:juancpinzonz@gmail.com" className="text-[#1e3a5f] underline">
              juancpinzonz@gmail.com
            </a>{' '}
            y lo resolveremos.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">5. Disponibilidad del servicio</h2>
          <p>
            El servicio de sincronización en la nube (Supabase) se presta en régimen de{' '}
            <strong>mejor esfuerzo</strong>. No garantizamos una disponibilidad del 100%.
          </p>
          <p className="mt-2">
            La funcionalidad principal de punto de venta opera completamente sin internet
            gracias al almacenamiento local. La sincronización se recupera automáticamente
            cuando se restablece la conexión.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">6. Responsabilidades del usuario</h2>
          <p>
            POS Tienda es una herramienta de apoyo para la gestión de su negocio. Usted es el
            único responsable de:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Sus decisiones comerciales, contables y tributarias</li>
            <li>La exactitud de los datos que ingresa al sistema</li>
            <li>El cumplimiento de sus obligaciones fiscales ante la DIAN</li>
            <li>El tratamiento adecuado de los datos personales de sus clientes (Ley 1581/2012)</li>
            <li>La custodia de sus credenciales de acceso</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">7. Limitación de responsabilidad</h2>
          <p>
            En la máxima medida permitida por la ley colombiana, POS Tienda no será responsable
            por pérdidas de datos, pérdidas de ingresos, decisiones comerciales tomadas con base
            en la información del sistema, ni por cualquier daño indirecto o consecuente derivado
            del uso o la imposibilidad de usar el servicio.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">8. Suspensión de cuenta</h2>
          <p>
            Nos reservamos el derecho de suspender o terminar el acceso al servicio si detectamos
            uso fraudulento, intento de eludir los mecanismos de pago o activación, o cualquier
            actividad que viole estos términos.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">9. Actualizaciones del software</h2>
          <p>
            El software se actualiza automáticamente. Nos reservamos el derecho de modificar,
            agregar o eliminar funcionalidades. Los cambios que afecten significativamente el
            servicio serán notificados dentro de la aplicación con al menos 15 días de anticipación.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">10. Ley aplicable y jurisdicción</h2>
          <p>
            Estos términos se rigen por las leyes de la República de Colombia. Cualquier
            controversia derivada de su interpretación o cumplimiento será resuelta por los
            tribunales competentes de la ciudad de Bogotá, D.C.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-base mb-2">11. Contacto</h2>
          <p>
            Para cualquier consulta sobre estos términos:{' '}
            <a href="mailto:juancpinzonz@gmail.com" className="text-[#1e3a5f] underline">
              juancpinzonz@gmail.com
            </a>
          </p>
          <p className="mt-1">
            WhatsApp:{' '}
            <a
              href="https://wa.me/573000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1e3a5f] underline"
            >
              Soporte POS Tienda
            </a>
          </p>
        </section>

        <div className="border-t border-gray-200 dark:border-gray-800 pt-4 text-center text-xs text-gray-400">
          <p>POS Tienda de Barrio · Bogotá, Colombia</p>
          <p className="mt-1">
            <button type="button" onClick={() => navigate('/privacy')} className="underline hover:text-gray-600">
              Ver Política de Privacidad
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}
