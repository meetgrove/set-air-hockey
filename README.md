# ⚡ SET ARENA // 1v1 Air Hockey Multiplayer Oyunu

Üniversite Topluluk Tanıtım Günleri (SET - Sportif ve Sosyal Etkinlikler Topluluğu) için geliştirilmiş gerçek zamanlı 1v1 Air Hockey oyunu, canlı stant skor ekranı ve çekiliş/ödül form entegrasyonu.

---

## 🌟 Özellikler

1. **Çoklu Oyun Modları:**
   - 📱 **QR Kod ile 2 Telefon:** İki oyuncu kendi telefonlarından QR kodu okutarak anında WebSocket üzerinden 1v1 eşleşir.
   - 📲 **Aynı Ekranda 1v1 (Local Tablet):** Stant masasında duran tek bir tablet/telefonda çift taraflı dokunmatik ekran kontrolü.
   - 🤖 **Yapay Zeka (Bot Antrenman):** Tek kişilik dinamik raket fiziğine sahip antrenman modu.

2. **📺 Canlı Stant / TV Ekranı (`/stand.html`):**
   - Dev QR Kod: Katılımcıların kamerayla anında oyuna girmesini sağlar.
   - Günün Şampiyonları (Canlı Liderlik Tablosu): En çok galibiyet ve gol alan oyuncuların sıralaması (🥇, 🥈, 🥉 madalyalar).
   - Canlı Maç Akışı: Son biten maçların skorları anlık olarak akar.
   - Anlık Sayaçlar: Toplam oynanan maç sayısı ve kayıtlı katılımcı sayısı.
   - Excel / CSV İndir: Tek tıkla tüm katılımcı ve çekiliş listesini UTF-8 BOM formatında indirir.

3. **🎁 Ödül & Çekiliş Formu Entegrasyonu:**
   - Maç sonunda kazanan oyuncuya özel "Stand Hediyeni Al" rozeti gösterilir.
   - Büyük çekilişe katılmak için bölüm ve iletişim bilgilerini giren oyuncuya anında benzersiz bilet numarası (`#SET-XXX`) üretilir.

---

## 🚀 Çalıştırma

### Yerel Ortamda:
```bash
npm install
npm start
```
- Oyun: `http://localhost:3000`
- Stant Ekranı: `http://localhost:3000/stand`

---

## 🌐 7/24 Bulut Kurulumu (Render.com - Bilgisayar Kapalıyken de Açık Link)

1. [render.com](https://render.com) adresine gidin.
2. **New +** -> **Web Service** seçin.
3. `meetgrove/set-air-hockey` deposunu bağlayın.
4. "Deploy Web Service" butonuna tıklayın.
5. Render size 7/24 açık kalacak kalıcı bir adres tahsis eder (Örn: `https://set-air-hockey.onrender.com`).
