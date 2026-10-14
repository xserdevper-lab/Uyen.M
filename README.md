# Uyen.M Wallet

เว็บกระเป๋าเงินแบบ mobile-first สำหรับ GitHub Pages โดยใช้ Google Sheet เป็นฐานข้อมูล

ติดตั้งเป็น PWA บน Android, Chrome และ Edge ได้จากเมนู **ติดตั้งแอป** หลังเปิดผ่าน HTTPS บน GitHub Pages

## หลักการสำคัญ

- ยอดเงินคำนวณจากรายการ `credit` และ `debit` ใน `Wallet_Transactions`
- หน้าเว็บไม่มีคำสั่งเพิ่มยอดเงิน
- การเพิ่มยอด (`action=credit`) ต้องมาจากแอปเงินรวมและส่ง `MAIN_APP_API_KEY`
- `externalId` ต้องไม่ซ้ำ ป้องกันการเพิ่มยอดซ้ำจากการ retry
- การ “ขอรับเงิน” จะสร้างรายการสถานะ `pending` เท่านั้น ยอดเงินไม่เปลี่ยน

## ทดลองหน้าจอ

เปิด `index.html?demo=1` เพื่อดูตัวอย่างยอด ฿2,000 โดยไม่เขียนข้อมูลลง Google Sheet

## เชื่อม Google Sheet

1. เปิด Google Sheet `A-mocashs` > **ส่วนขยาย > Apps Script**
2. นำ `apps-script/Code.gs` และ `apps-script/appsscript.json` ไปวางในโปรเจกต์
3. รัน `setupWalletDatabase()` หนึ่งครั้ง เพื่อสร้างแท็บ `Wallet_Accounts`, `Wallet_Transactions`, `Wallet_Requests`
4. ใน **Project Settings > Script properties** เพิ่ม `MAIN_APP_API_KEY` เป็นค่าสุ่มยาวที่เก็บไว้เฉพาะในแอปเงินรวม
5. Deploy เป็น Web app โดย Execute as: **Me** และ Who has access: **Anyone**
6. นำ Web app URL ใส่ใน `config.js` ที่ `apiUrl`

> ห้ามใส่ `MAIN_APP_API_KEY` ใน `config.js` หรือโค้ด GitHub Pages เพราะไฟล์หน้าเว็บเป็นสาธารณะ

## ตัวอย่างที่แอปเงินรวมใช้จ่ายเงินเข้า

ส่ง `POST` แบบ `application/x-www-form-urlencoded` ไปยัง Web app URL:

```text
action=credit
walletId=uyen
externalId=MAIN-20261014-0001
amount=2000
note=เงินประจำสัปดาห์
apiKey=<MAIN_APP_API_KEY>
```

เมื่อสำเร็จ หน้า Uyen.M จะดึงยอดใหม่อัตโนมัติทุก 30 วินาที

## GitHub Pages

ตั้งค่า Pages ให้ deploy จาก branch `main` และโฟลเดอร์ `/ (root)`


