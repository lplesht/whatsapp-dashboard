# לוח אירועים מוואטסאפ

מערכת שמחלצת אירועים (ימי הולדת, מסיבות, טיולים) מקבוצות וואטסאפ נבחרות ומציגה אותם בדאשבורד. סנכרון על פי דרישה — לוחצים כפתור, לא מאזין ברקע.

## מבנה הפרויקט

```
src/config.js        ← whitelist של קבוצות + מילות מפתח (ערוך פה!)
src/baileys-client.js ← חיבור וואטסאפ + סינון whitelist
src/extractor.js      ← קריאה ל-Claude API לחילוץ אירועים
src/db.js             ← מסד נתונים SQLite
src/server.js         ← שרת Express (/sync, /events)
public/index.html     ← הדאשבורד (PWA)
public/qr.html         ← דף לסריקת קוד ה-QR
```

## שלב 1: הקמת חשבון GitHub ו-repo

1. באתר github.com (אפשר מהאייפון), צור repo פרטי חדש בשם `whatsapp-dashboard`
2. העלה את כל התיקייה הזו אליו (git push) — או פשוט גרור את הקבצים דרך ממשק ה-web של GitHub אם אתה עובד מהנייד בלי טרמינל

## שלב 2: הקמת ה-VPS

1. הרשמה ל-Hetzner Cloud או DigitalOcean (דרך הדפדפן)
2. יצירת שרת Ubuntu 24.04 קטן (cx22 / droplet בסיסי, ~$5/חודש)
3. הוספת מפתח SSH (אם עובדים מהאייפון — אפליקציית **Termius** יכולה גם ליצור מפתח וגם להתחבר)

## שלב 3: התחברות לשרת והתקנה

דרך אפליקציית SSH (Termius מומלץ לאייפון):

```bash
# התקנת Node.js ו-git
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git

# שכפול הקוד מ-GitHub
git clone https://github.com/USERNAME/whatsapp-dashboard.git
cd whatsapp-dashboard
npm install

# הגדרת משתני סביבה
cp .env.example .env
nano .env   # למלא ANTHROPIC_API_KEY ו-SYNC_TOKEN
```

## שלב 4: הגדרת ה-whitelist

ערוך את `src/config.js` והוסף את מזהי הקבוצות הרלוונטיים ל-`ALLOWED_GROUPS`. בסבב הראשון הרשימה ריקה בכוונה — תריץ את השרת, שלח הודעת בדיקה בקבוצה, וה-console ידפיס את מזהה הקבוצה כדי שתוכל להעתיק אותו.

## שלב 5: הרצה ראשונית + סריקת QR

```bash
npm run start
```

בפעם הראשונה תופיע הודעה שקוד QR נכתב. פתח בדפדפן (מכל מכשיר):
```
http://<כתובת-השרת>:3000/qr
```
וסרוק עם וואטסאפ ← הגדרות ← מכשירים מקושרים ← קישור מכשיר.

## שלב 6: הרצה קבועה עם pm2

```bash
npm install -g pm2
pm2 start src/server.js --name whatsapp-dashboard
pm2 save
pm2 startup   # מבטיח שהשרת יעלה מחדש אחרי איתחול
```

## שלב 7: גישה מהאייפון

פתח בספארי: `http://<כתובת-השרת>:3000` → שתף → הוסף למסך הבית (הופך ל-PWA שנראה כמו אפליקציה).

בכניסה הראשונה תתבקש להזין את ה-`SYNC_TOKEN` שהגדרת ב-`.env` (נשמר מקומית בטלפון).

## הערות אבטחה
- לא נשמר טקסט הודעה גולמי במסד הנתונים — רק האירוע המחולץ
- ה-endpoint של `/sync` דורש טוקן סודי (`x-sync-token`) — בלעדיו אף אחד לא יכול להפעיל סנכרון
- מומלץ מאוד להוסיף HTTPS (nginx/Caddy + Let's Encrypt) לפני שימוש קבוע, כדי שהטוקן לא יעבור בטקסט גלוי
