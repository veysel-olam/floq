import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Hizmet Koşulları — floq',
  description: 'floq hizmet koşulları',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-(--color-background)">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Ana sayfaya dön
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1
            className="text-3xl font-bold text-(--color-coral) mb-2"
            style={{ fontFamily: 'var(--font-outfit)' }}
          >
            Hizmet Koşulları
          </h1>
          <p className="text-sm text-(--color-text-tertiary)">Son güncelleme: Mayıs 2025</p>
        </div>

        {/* Sections */}
        <div className="space-y-8">

          {/* 1 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              1. Hizmetin Kapsamı
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
              floq, AT Protocol ve ActivityPub protokollerini köprüleyen, federe bir sosyal ağ platformudur.
              Hesabın hem Bluesky ekosistemine hem de Mastodon gibi ActivityPub uyumlu sunuculara bağlanabilir.
              floq bir mezuniyet projesi olarak geliştirilmekte olup hizmet sürekli güncellenmektedir.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              2. Hesap ve Üyelik
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-2">
              floq&apos;u kullanmak için kayıt olman gerekmektedir. Kayıt sırasında geçerli bir e-posta adresi ve
              kullanıcı adı belirlemelisin.
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-(--color-text-secondary)">
              <li>floq&apos;u kullanmak için en az <strong>13 yaşında</strong> olman gerekir.</li>
              <li>Hesap güvenliğinden (şifre, 2FA) sen sorumlusun.</li>
              <li>Hesap bilgilerinin doğruluğunu sağlamak kullanıcının yükümlülüğündedir.</li>
              <li>Bir hesap yalnızca bir kişiye aittir; hesap devredilemez.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              3. İçerik Politikası
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-2">
              floq&apos;ta paylaştığın içeriklerden sen sorumlusun. Aşağıdaki içerikler kesinlikle yasaktır:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-(--color-text-secondary) mb-3">
              <li>Nefret söylemi, ayrımcılık veya şiddete teşvik</li>
              <li>Çocukları istismar eden veya zarara uğratan her türlü içerik</li>
              <li>Kişisel verilerin izinsiz paylaşılması (doxxing)</li>
              <li>Spam, sahte hesaplar ve yanıltıcı bilgi</li>
              <li>Telif hakkı ihlali içeren materyaller</li>
            </ul>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
              Paylaştığın içeriklerin fikri mülkiyet hakları sende kalır. floq&apos;a hizmeti sunmak amacıyla
              içeriklerini işleme, depolama ve federe ağlara iletme izni vermiş olursun.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              4. Gizlilik
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
              Verilerinin nasıl toplandığı ve kullanıldığı hakkında ayrıntılı bilgi için{' '}
              <Link href="/privacy" className="text-(--color-coral) hover:underline font-medium">
                Gizlilik Politikamızı
              </Link>{' '}
              inceleyebilirsin.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              5. Hizmet Kesintileri
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
              floq bir mezuniyet projesi olduğundan kesintisiz ve hatasız hizmet garantisi verilmemektedir.
              Bakım, güncelleme veya beklenmedik teknik sorunlar nedeniyle hizmete erişim geçici olarak
              kesilebilir. Bu tür durumlarda sorumluluk kabul edilmemektedir.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              6. Hesap Feshi
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
              Bu koşulları veya içerik politikasını ihlal etmen durumunda hesabın önceden bildirim yapılmaksızın
              askıya alınabilir veya kalıcı olarak kapatılabilir. İhlal içeren içerikler silinebilir.
              Hesabını istediğin zaman Ayarlar &rarr; Hesap bölümünden kendin de kapatabilirsin.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              7. Değişiklikler
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
              Bu koşullar zaman zaman güncellenebilir. Önemli değişiklikler olduğunda kayıtlı e-posta adresine
              bildirim gönderilir. Değişiklikler yayınlandıktan sonra hizmeti kullanmaya devam etmen, yeni
              koşulları kabul ettiğin anlamına gelir.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-(--color-border) flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-(--color-text-tertiary)">
            Sorular için:{' '}
            <a href="mailto:destek@floq.com" className="text-(--color-coral) hover:underline">
              destek@floq.com
            </a>
          </p>
          <Link
            href="/"
            className="text-sm text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
          >
            floq ana sayfa
          </Link>
        </div>
      </div>
    </div>
  )
}
