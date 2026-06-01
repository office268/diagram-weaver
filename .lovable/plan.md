## מטרה
להחזיר את ההתחברות עם Google לעבודה בלי לשנות את הלוגיקה באפליקציה, כי הקוד כבר משתמש בזרימת Google של Lovable Cloud.

## מה אבדוק ואאמת
1. **מקור הבעיה**
   - לאמת אם ב-Cloud מוגדרים **credentials מותאמים אישית** ל-Google.
   - אם כן, לוודא שה-Client ID וה-Client Secret תואמים בדיוק לאותו OAuth Client ב-Google Cloud.

2. **כתובת callback הנכונה**
   - לא להשתמש בכתובת ישנה/ידנית.
   - לקחת את **Authorized redirect URL המדויק שמופיע בתוך Lovable Cloud** במסך:
     `Users → Auth Settings → Sign In Methods → Google`
   - לוודא שב-Google Cloud הכתובת הזו מופיעה בדיוק, בלי שינוי.

3. **בדיקת ה-OAuth Client ב-Google**
   - לוודא שה-Client הוא מסוג **Web application**.
   - לוודא שהוא לא נמחק / לא שייך לפרויקט Google אחר.
   - לוודא שה-Consent Screen והדומיינים המורשים תואמים לסביבה הפעילה.

4. **בידוד הבעיה**
   - לבדוק קודם על ה-URL המפורסם של האפליקציה, לא על preview.
   - אם המטרה אינה שימוש ב-credentials פרטיים, לעבור ל-**managed Google OAuth** של Lovable Cloud במקום credentials ידניים.

## תוצאה צפויה
אחד משני המסלולים יפתור את הבעיה:
- **מסלול מהיר:** לכבות credentials ידניים ולהשתמש ב-managed Google OAuth.
- **מסלול מותאם אישית:** להשאיר credentials ידניים אבל לעדכן ב-Google Cloud את ה-client וה-callback המדויקים שמופיעים ב-Lovable Cloud.

## פרטים טכניים
- מצאתי שהקוד כבר קורא ל-`lovable.auth.signInWithOAuth("google")`, ולכן זו לא נראית כבעיית קוד.
- שגיאת `401 invalid_client` מצביעה בדרך כלל על **Client ID / Client Secret שגויים**, client מפרויקט אחר, או OAuth Client שכבר לא תקף.
- אם הייתה בעיית callback בלבד, בדרך כלל היינו מצפים יותר ל-`redirect_uri_mismatch` ולא ל-`invalid_client`.
- לכן החשד הראשי הוא **custom Google credentials** ב-Cloud, לא מימוש ה-login בעמוד עצמו.