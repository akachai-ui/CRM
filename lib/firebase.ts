import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ข้อมูล Configuration ของคุณ
const firebaseConfig = {
  apiKey: "AIzaSyCvETjn64UKEHMDTvnl5jYDx2N387Aw9-U",
  authDomain: "salemanagement-b511c.firebaseapp.com",
  projectId: "salemanagement-b511c",
  storageBucket: "salemanagement-b511c.firebasestorage.app",
  messagingSenderId: "690168124627",
  appId: "1:690168124627:web:137fd074d3c9172e667026",
  measurementId: "G-QYWG80FM49"
};

// ตรวจสอบก่อนว่ามีการเปิดใช้ Firebase ไปหรือยัง (เทคนิคสำคัญของ Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ส่งออก db (Firestore) ไปให้หน้าอื่นๆ ในเว็บเรียกใช้ได้ง่ายๆ
export const db = getFirestore(app);