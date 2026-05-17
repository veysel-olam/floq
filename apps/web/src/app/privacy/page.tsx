import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Gizlilik Politikası — floq',
  description: 'floq gizlilik politikası',
}

export default function PrivacyPage() {
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
            Gizlilik Politikası
          </h1>
          <p className="text-sm text-(--color-text-tertiary)">Son güncelleme: Mayıs 2025</p>
        </div>

        {/* Sections */}
        <div className="space-y-8">

          {/* 1 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              1. Toplanan Veriler
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-2">
              floq, hizmeti sunabilmek için aşağıdaki verileri toplar:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-(--color-text-secondary)">
              <li><strong>Hesap bilgileri:</strong> e-posta adresi, kullanıcı adı, görünen ad ve profil fotoğrafı</li>
              <li><strong>İçerikler:</strong> paylaştığın gönderiler, yorumlar ve momentler</li>
              <li><strong>Sosyal grafik:</strong> takip ettiğin ve seni takip eden hesaplar</li>
              <li><strong>Teknik veriler:</strong> IP adresi, oturum bilgileri ve tarayıcı türü (güvenlik ve hata ayıklama amacıyla loglanır)</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              2. Veri Kullanımı
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-2">
              Toplanan veriler yalnızca şu amaçlarla kullanılır:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-(--color-text-secondary)">
              <li>Hizmetin sunulması ve kişiselleştirilmesi</li>
              <li>Hesap güvenliğinin sağlanması ve doğrulama işlemleri</li>
              <li>Hizmet hakkında önemli bilgilerin iletilmesi (e-posta ile)</li>
              <li>Kötüye kullanım ve spam tespiti</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              3. Veri Paylaşımı
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-2">
              Verilerini üçüncü taraf şirketlerle satmıyor veya ticari amaçla paylaşmıyoruz.
            </p>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
              Bununla birlikte, floq federe bir ağdır. <strong>Herkese açık</strong> olarak paylaştığın içerikler
              AT Protocol ve ActivityPub protokolleri aracılığıyla Bluesky, Mastodon gibi diğer sunuculara
              yayılabilir. Bu sunucuların kendi gizlilik politikaları geçerlidir. Yalnızca yakın çevrenle veya
              kilitli hesabınla paylaştığın içerikler dışarıya iletilmez.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              4. Veri Saklama
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-2">
              Verilerini hesabın aktif olduğu sürece saklarız. Hesabını sildiğinde tüm kişisel verilerini ve
              içeriklerini sistemden kaldırırız.
            </p>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
              <strong>Momentler</strong> özel bir kurala tabidir: paylaşımdan itibaren <strong>24 saat</strong> sonra
              otomatik olarak silinirler.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              5. Güvenlik
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-2">
              Verilerinin güvenliği için aşağıdaki önlemleri alıyoruz:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-(--color-text-secondary)">
              <li>Tüm bağlantılar <strong>HTTPS/TLS</strong> ile şifrelenir</li>
              <li>Parolalar <strong>bcrypt</strong> algoritması ile hashlenerek saklanır</li>
              <li>İki faktörlü doğrulama (TOTP) desteği sunulmaktadır</li>
              <li>Oturum yönetimi ve anormal giriş tespiti aktiftir</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              6. Çerezler
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-2">
              floq yalnızca zorunlu çerezleri kullanır:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-(--color-text-secondary)">
              <li><strong>Oturum çerezi:</strong> Giriş durumunu korumak için gereklidir. Tarayıcıyı kapattığında sona erer.</li>
              <li><strong>Tercih çerezi:</strong> Tema, yazı boyutu gibi görünüm tercihlerini hatırlamak için kullanılır.</li>
            </ul>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mt-2">
              Reklam veya izleme amacıyla herhangi bir üçüncü taraf çerezi kullanılmamaktadır.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              7. Haklarınız
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed mb-2">
              KVKK (Kişisel Verilerin Korunması Kanunu) ve GDPR kapsamında aşağıdaki haklara sahipsin:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-(--color-text-secondary)">
              <li><strong>Erişim:</strong> Sana ait hangi verilerin tutulduğunu öğrenebilirsin</li>
              <li><strong>Düzeltme:</strong> Hatalı veya eksik verilerin düzeltilmesini talep edebilirsin</li>
              <li><strong>Silme:</strong> Hesabını ve tüm verilerini kalıcı olarak silebilirsin (Ayarlar &rarr; Hesap)</li>
              <li><strong>Taşınabilirlik:</strong> Verilerini JSON formatında dışa aktarabilirsin (Ayarlar &rarr; Hesap &rarr; Veri İndir)</li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-semibold text-(--color-text-primary) mb-3">
              8. İletişim
            </h2>
            <p className="text-sm text-(--color-text-secondary) leading-relaxed">
              Gizlilikle ilgili sorularını veya taleplerinizi{' '}
              <a href="mailto:destek@floq.com" className="text-(--color-coral) hover:underline font-medium">
                destek@floq.com
              </a>{' '}
              adresine iletebilirsin.
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-(--color-border) flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-(--color-text-tertiary)">
            İletişim:{' '}
            <a href="mailto:destek@floq.com" className="text-(--color-coral) hover:underline">
              destek@floq.com
            </a>
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/terms"
              className="text-sm text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
            >
              Hizmet Koşulları
            </Link>
            <Link
              href="/"
              className="text-sm text-(--color-text-tertiary) hover:text-(--color-text-primary) transition-colors"
            >
              floq ana sayfa
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
