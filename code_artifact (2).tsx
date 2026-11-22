import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import {
  Home,
  Calendar,
  HardHat,
  Users,
  Wallet,
  Receipt,
  Package,
  Wrench,
  ShieldCheck,
  BarChart3,
  Plus,
  Search,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Edit3,
  Trash2,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  UserCheck,
  Sparkles,
  RefreshCw,
  Filter,
  Smartphone,
  Tablet,
  Menu,
  Check,
  FileText,
  DollarSign,
  TrendingUp,
  Layers,
  ShieldAlert,
  Navigation,
} from 'lucide-react';

// ============================================================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ============================================================================
const firebaseConfig =
  typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : {
        apiKey: 'demo-key',
        authDomain: 'demo.firebaseapp.com',
        projectId: 'demo-project',
      };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'mosquito-shop-erp';

// ============================================================================
// UTILITY HELPERS (THAI FORMATTING & DATES)
// ============================================================================
const getTodayISO = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

const getOffsetDateISO = (days) => {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

const formatThaiDate = (isoDate) => {
  if (!isoDate) return '-';
  const months = [
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.',
  ];
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = parseInt(parts[0], 10) + 543;
  const month = months[parseInt(parts[1], 10) - 1] || '';
  const day = parseInt(parts[2], 10);
  return `${day} ${month} ${year}`;
};

const formatCurrency = (num) => {
  const val = Number(num) || 0;
  return val.toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

const addYearsToDate = (isoDate, years) => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  d.setFullYear(d.getFullYear() + Number(years || 1));
  return d.toISOString().split('T')[0];
};

const getWarrantyStatus = (expiryDate) => {
  if (!expiryDate) return { label: 'ไม่มีประกัน', color: 'slate', daysLeft: 0 };
  const today = new Date(getTodayISO());
  const exp = new Date(expiryDate);
  const diffTime = exp - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { label: 'หมดประกัน', color: 'rose', daysLeft: diffDays };
  }
  if (diffDays <= 60) {
    return {
      label: `ใกล้หมด (${diffDays} วัน)`,
      color: 'amber',
      daysLeft: diffDays,
    };
  }
  return { label: 'อยู่ในประกัน', color: 'emerald', daysLeft: diffDays };
};

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================
export default function App() {
  // Authentication & Sync State
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('connecting'); // connecting | synced | error
  const [userRole, setUserRole] = useState('owner'); // 'owner' | 'technician'
  const [selectedTechFilter, setSelectedTechFilter] = useState('all');

  // Navigation & UI State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Firestore Collections State
  const [customers, setCustomers] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [inventory, setInventory] = useState([]);

  // Global Modals & Drawers
  const [jobModal, setJobModal] = useState({ open: false, data: null });
  const [customerDrawer, setCustomerDrawer] = useState({
    open: false,
    customer: null,
  });
  const [customerModal, setCustomerModal] = useState({
    open: false,
    data: null,
  });
  const [techModal, setTechModal] = useState({ open: false, data: null });
  const [incomeModal, setIncomeModal] = useState({
    open: false,
    job: null,
    defaultType: 'ชำระส่วนที่เหลือ',
  });
  const [expenseModal, setExpenseModal] = useState({
    open: false,
    data: null,
  });
  const [inventoryModal, setInventoryModal] = useState({
    open: false,
    data: null,
  });
  const [stockAdjustModal, setStockAdjustModal] = useState({
    open: false,
    item: null,
    mode: 'out', // 'in' | 'out'
  });
  const [issueModal, setIssueModal] = useState({ open: false, job: null });
  const [seeding, setSeeding] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --------------------------------------------------------------------------
  // 1. FIREBASE AUTHENTICATION (MANDATORY PATTERN)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== 'undefined' &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth error:', err);
        setSyncStatus('error');
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setSyncStatus('synced');
      }
    });
    return () => unsubscribe();
  }, []);

  // --------------------------------------------------------------------------
  // 2. REAL-TIME FIRESTORE LISTENERS (PUBLIC SHARED SHOP DATA)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const basePath = ['artifacts', appId, 'public', 'data'];

    const unsubCustomers = onSnapshot(
      collection(db, ...basePath, 'customers'),
      (snap) => {
        setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSyncStatus('synced');
      },
      (err) => {
        console.error('Customers sync error:', err);
        setSyncStatus('error');
      }
    );

    const unsubTechs = onSnapshot(
      collection(db, ...basePath, 'technicians'),
      (snap) => {
        setTechnicians(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error('Technicians sync error:', err)
    );

    const unsubJobs = onSnapshot(
      collection(db, ...basePath, 'jobs'),
      (snap) => {
        setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error('Jobs sync error:', err)
    );

    const unsubIncomes = onSnapshot(
      collection(db, ...basePath, 'incomes'),
      (snap) => {
        setIncomes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error('Incomes sync error:', err)
    );

    const unsubExpenses = onSnapshot(
      collection(db, ...basePath, 'expenses'),
      (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error('Expenses sync error:', err)
    );

    const unsubInventory = onSnapshot(
      collection(db, ...basePath, 'inventory'),
      (snap) => {
        setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error('Inventory sync error:', err)
    );

    return () => {
      unsubCustomers();
      unsubTechs();
      unsubJobs();
      unsubIncomes();
      unsubExpenses();
      unsubInventory();
    };
  }, [user]);

  // --------------------------------------------------------------------------
  // SEED SAMPLE THAI DATA (FOR IMMEDIATE TESTING ON TABLET/MOBILE)
  // --------------------------------------------------------------------------
  const handleSeedDemoData = async () => {
    if (!user || seeding) return;
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      const basePath = ['artifacts', appId, 'public', 'data'];
      const today = getTodayISO();
      const tomorrow = getOffsetDateISO(1);
      const yesterday = getOffsetDateISO(-1);
      const lastWeek = getOffsetDateISO(-7);

      // 1. Technicians
      const techRefs = [
        {
          id: 'tech_1',
          name: 'ช่างสมชาย (หัวหน้าทีม)',
          role: 'หัวหน้าช่างติดตั้ง',
          phone: '081-234-5678',
          status: 'พร้อมปฏิบัติงาน',
        },
        {
          id: 'tech_2',
          name: 'ช่างเอกพล',
          role: 'ช่างประกอบ/ติดตั้ง',
          phone: '089-876-5432',
          status: 'พร้อมปฏิบัติงาน',
        },
        {
          id: 'tech_3',
          name: 'ช่างบอย',
          role: 'ช่างติดตั้งมุ้งจีบ',
          phone: '086-555-4321',
          status: 'พร้อมปฏิบัติงาน',
        },
      ];
      techRefs.forEach((t) => {
        batch.set(doc(db, ...basePath, 'technicians', t.id), t);
      });

      // 2. Customers
      const custRefs = [
        {
          id: 'cust_1',
          name: 'คุณวิชัย รัตนกุล',
          phone: '081-999-1122',
          address: 'หมู่บ้านมัณฑนา บางนา-วงแหวน ซอย 5 บ้านเลขที่ 88/12',
          note: 'บ้านเดี่ยว 2 ชั้น เน้นงานเรียบร้อย มีสัตว์เลี้ยง',
          createdAt: lastWeek,
        },
        {
          id: 'cust_2',
          name: 'คุณนภาวรรณ ศรีสุข',
          phone: '089-444-7788',
          address: 'โครงการศุภาลัย วิลล์ รังสิต คลอง 3 เลขที่ 19/45',
          note: 'ติดต่อช่วงเช้าสะดวกสุด',
          createdAt: yesterday,
        },
        {
          id: 'cust_3',
          name: 'คุณธนกร เจริญทรัพย์',
          phone: '092-333-8899',
          address: 'คอนโด Ideo สุขุมวิท 93 ชั้น 18 ห้อง 1804',
          note: 'ต้องแลกบัตรที่นิติบุคคลก่อนขึ้นอาคาร',
          createdAt: today,
        },
        {
          id: 'cust_4',
          name: 'คุณพรทิพย์ วงศ์สวัสดิ์',
          phone: '085-111-2233',
          address: 'หมู่บ้านบางกอก บูเลอวาร์ด พระราม 9 เลขที่ 102/8',
          note: 'ลูกค้าเก่า แนะนำเพื่อนบ้านมา',
          createdAt: getOffsetDateISO(-30),
        },
      ];
      custRefs.forEach((c) => {
        batch.set(doc(db, ...basePath, 'customers', c.id), c);
      });

      // 3. Jobs
      const jobRefs = [
        {
          id: 'job_1',
          jobCode: 'JOB-6901',
          customerId: 'cust_1',
          customerName: 'คุณวิชัย รัตนกุล',
          customerPhone: '081-999-1122',
          location: 'หมู่บ้านมัณฑนา บางนา-วงแหวน ซอย 5 บ้านเลขที่ 88/12',
          date: today,
          time: '09:30',
          details:
            'มุ้งจีบเก็บซ่อนราง 8 บาน + มุ้งบานเลื่อน 4 บาน (อลูมิเนียมสีดำด้าน มุ้งไฟเบอร์เทา)',
          totalAmount: 24500,
          depositAmount: 10000,
          paidAmount: 10000,
          techId: 'tech_1',
          techName: 'ช่างสมชาย (หัวหน้าทีม)',
          helperCount: 2,
          status: 'กำลังทำ',
          warrantyYears: 2,
          issueNote: '',
        },
        {
          id: 'job_2',
          jobCode: 'JOB-6902',
          customerId: 'cust_3',
          customerName: 'คุณธนกร เจริญทรัพย์',
          customerPhone: '092-333-8899',
          location: 'คอนโด Ideo สุขุมวิท 93 ชั้น 18 ห้อง 1804',
          date: today,
          time: '14:00',
          details:
            'มุ้งม้วนเก็บอัตโนมัติ 2 บาน + มุ้งจีบประตูระเบียง 1 บาน (สีอบขาว)',
          totalAmount: 9800,
          depositAmount: 3000,
          paidAmount: 3000,
          techId: 'tech_3',
          techName: 'ช่างบอย',
          helperCount: 1,
          status: 'รอดำเนินการ',
          warrantyYears: 1,
          issueNote: '',
        },
        {
          id: 'job_3',
          jobCode: 'JOB-6903',
          customerId: 'cust_2',
          customerName: 'คุณนภาวรรณ ศรีสุข',
          customerPhone: '089-444-7788',
          location: 'โครงการศุภาลัย วิลล์ รังสิต คลอง 3 เลขที่ 19/45',
          date: tomorrow,
          time: '10:00',
          details:
            'มุ้งนิรภัย Steel Mesh ประตูหน้าบ้าน 1 ชุด + หน้าต่าง 6 บาน (สีชาดำ)',
          totalAmount: 36000,
          depositAmount: 15000,
          paidAmount: 15000,
          techId: 'tech_1',
          techName: 'ช่างสมชาย (หัวหน้าทีม)',
          helperCount: 2,
          status: 'รอดำเนินการ',
          warrantyYears: 5,
          issueNote: '',
        },
        {
          id: 'job_4',
          jobCode: 'JOB-6898',
          customerId: 'cust_4',
          customerName: 'คุณพรทิพย์ วงศ์สวัสดิ์',
          customerPhone: '085-111-2233',
          location: 'หมู่บ้านบางกอก บูเลอวาร์ด พระราม 9 เลขที่ 102/8',
          date: yesterday,
          time: '10:30',
          details: 'มุ้งจีบทั้งหลัง 12 บาน (สีลายไม้สัก)',
          totalAmount: 32000,
          depositAmount: 10000,
          paidAmount: 32000,
          techId: 'tech_2',
          techName: 'ช่างเอกพล',
          helperCount: 1,
          status: 'เสร็จสิ้น',
          completedDate: yesterday,
          warrantyYears: 2,
          warrantyExpiry: addYearsToDate(yesterday, 2),
          issueNote: '',
        },
        {
          id: 'job_5',
          jobCode: 'JOB-6895',
          customerId: 'cust_1',
          customerName: 'คุณวิชัย รัตนกุล',
          customerPhone: '081-999-1122',
          location: 'หมู่บ้านมัณฑนา บางนา-วงแหวน ซอย 5 (ส่วนต่อเติมครัว)',
          date: lastWeek,
          time: '13:30',
          details: 'มุ้งบานเปิดห้องครัว 2 บาน (รอเปลี่ยนมือจับล็อกสีดำ)',
          totalAmount: 6500,
          depositAmount: 3000,
          paidAmount: 3000,
          techId: 'tech_2',
          techName: 'ช่างเอกพล',
          helperCount: 1,
          status: 'มีปัญหา',
          warrantyYears: 1,
          issueNote:
            'ลูกค้าขอเปลี่ยนตัวล็อกเป็นแบบกุญแจล็อกได้ รอเบิกอะไหล่เข้าเก็บงาน',
        },
      ];
      jobRefs.forEach((j) => {
        batch.set(doc(db, ...basePath, 'jobs', j.id), j);
      });

      // 4. Incomes
      const incomeRefs = [
        {
          id: 'inc_1',
          date: lastWeek,
          jobId: 'job_1',
          jobCode: 'JOB-6901',
          customerName: 'คุณวิชัย รัตนกุล',
          type: 'มัดจำ',
          method: 'โอนเงิน',
          amount: 10000,
          note: 'โอนเข้าบัญชีร้าน กสิกรไทย',
        },
        {
          id: 'inc_2',
          date: yesterday,
          jobId: 'job_4',
          jobCode: 'JOB-6898',
          customerName: 'คุณพรทิพย์ วงศ์สวัสดิ์',
          type: 'ชำระส่วนที่เหลือ',
          method: 'โอนเงิน',
          amount: 22000,
          note: 'ชำระครบปิดงานเรียบร้อย',
        },
        {
          id: 'inc_3',
          date: yesterday,
          jobId: 'job_2',
          jobCode: 'JOB-6902',
          customerName: 'คุณธนกร เจริญทรัพย์',
          type: 'มัดจำ',
          method: 'โอนเงิน',
          amount: 3000,
          note: 'มัดจำวันวัดหน้างาน',
        },
        {
          id: 'inc_4',
          date: today,
          jobId: 'job_3',
          jobCode: 'JOB-6903',
          customerName: 'คุณนภาวรรณ ศรีสุข',
          type: 'มัดจำ',
          method: 'เงินสด',
          amount: 15000,
          note: 'รับเงินสดหน้างาน',
        },
      ];
      incomeRefs.forEach((inc) => {
        batch.set(doc(db, ...basePath, 'incomes', inc.id), inc);
      });

      // 5. Expenses
      const expenseRefs = [
        {
          id: 'exp_1',
          date: yesterday,
          category: 'ค่าวัสดุ/อลูมิเนียม/มุ้ง',
          description: 'สั่งเส้นอลูมิเนียมสีดำด้าน + มุ้งจีบ 3 ม้วน (โรงงานสมุทรปราการ)',
          amount: 14200,
          staff: 'เจ้าของร้าน',
        },
        {
          id: 'exp_2',
          date: today,
          category: 'ค่าน้ำมัน',
          description: 'เติมน้ำมันรถกระบะติดตั้ง 2 คัน (บางนา-สุขุมวิท)',
          amount: 1500,
          staff: 'ช่างสมชาย',
        },
        {
          id: 'exp_3',
          date: today,
          category: 'ค่าแรงช่าง',
          description: 'เบิกค่าแรงรายวันผู้ช่วยช่าง 3 คน',
          amount: 1800,
          staff: 'ฝ่ายบัญชี',
        },
        {
          id: 'exp_4',
          date: yesterday,
          category: 'ค่าเดินทาง/ทางด่วน',
          description: 'เติมบัตร Easy Pass วิ่งงานโซนพระราม 9 - รังสิต',
          amount: 1000,
          staff: 'ช่างเอกพล',
        },
      ];
      expenseRefs.forEach((exp) => {
        batch.set(doc(db, ...basePath, 'expenses', exp.id), exp);
      });

      // 6. Inventory
      const invRefs = [
        {
          id: 'inv_1',
          sku: 'ALU-BK-01',
          name: 'เฟรมอลูมิเนียมมุ้งจีบ สีดำด้าน (6 เมตร)',
          category: 'อลูมิเนียม',
          qty: 28,
          unit: 'เส้น',
          minStock: 15,
        },
        {
          id: 'inv_2',
          sku: 'ALU-WH-02',
          name: 'เฟรมอลูมิเนียมบานเลื่อน สีอบขาว (6 เมตร)',
          category: 'อลูมิเนียม',
          qty: 8,
          unit: 'เส้น',
          minStock: 12,
        },
        {
          id: 'inv_3',
          sku: 'MSH-PL-01',
          name: 'ผ้ามุ้งจีบโพลีเอสเตอร์ สีเทาดำ (หน้ากว้าง 2.5m)',
          category: 'มุ้งลวด',
          qty: 6,
          unit: 'ม้วน',
          minStock: 3,
        },
        {
          id: 'inv_4',
          sku: 'MSH-FB-02',
          name: 'มุ้งไฟเบอร์กลาส สีเทา (หน้ากว้าง 1.2m)',
          category: 'มุ้งลวด',
          qty: 2,
          unit: 'ม้วน',
          minStock: 4,
        },
        {
          id: 'inv_5',
          sku: 'ACC-WH-01',
          name: 'ชุดล้อบานเลื่อนลูกปืนอย่างดี',
          category: 'อุปกรณ์/อะไหล่',
          qty: 45,
          unit: 'ตัว',
          minStock: 20,
        },
        {
          id: 'inv_6',
          sku: 'ACC-LK-02',
          name: 'มือจับล็อกมุ้งจีบ สีดำด้าน',
          category: 'อุปกรณ์/อะไหล่',
          qty: 4,
          unit: 'ชุด',
          minStock: 10,
        },
      ];
      invRefs.forEach((inv) => {
        batch.set(doc(db, ...basePath, 'inventory', inv.id), inv);
      });

      await batch.commit();
      showToast('โหลดข้อมูลตัวอย่างร้านมุ้งลวดเรียบร้อยแล้ว!');
    } catch (err) {
      console.error('Seed error:', err);
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลตัวอย่าง', 'error');
    } finally {
      setSeeding(false);
    }
  };

  // --------------------------------------------------------------------------
  // COMPUTED METRICS & DERIVED DATA
  // --------------------------------------------------------------------------
  const todayISO = getTodayISO();
  const currentMonthPrefix = todayISO.slice(0, 7); // YYYY-MM

  const metrics = useMemo(() => {
    const monthlyIncome = incomes
      .filter((i) => (i.date || '').startsWith(currentMonthPrefix))
      .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    const monthlyExpense = expenses
      .filter((e) => (e.date || '').startsWith(currentMonthPrefix))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const todaysJobs = jobs.filter((j) => j.date === todayISO);

    const unpaidJobs = jobs.filter((j) => {
      const total = Number(j.totalAmount) || 0;
      const paid = Number(j.paidAmount) || 0;
      return total - paid > 0 && j.status !== 'ยกเลิก';
    });

    const totalUnpaidBalance = unpaidJobs.reduce(
      (sum, j) => sum + ((Number(j.totalAmount) || 0) - (Number(j.paidAmount) || 0)),
      0
    );

    const lowStockItems = inventory.filter(
      (item) => Number(item.qty) <= Number(item.minStock)
    );

    const issueJobs = jobs.filter((j) => j.status === 'มีปัญหา');

    return {
      monthlyIncome,
      monthlyExpense,
      monthlyProfit: monthlyIncome - monthlyExpense,
      todaysJobs,
      unpaidJobs,
      totalUnpaidBalance,
      lowStockItems,
      issueJobs,
    };
  }, [incomes, expenses, jobs, inventory, todayISO, currentMonthPrefix]);

  // --------------------------------------------------------------------------
  // CRUD HANDLERS FOR FIRESTORE
  // --------------------------------------------------------------------------
  const baseCol = (name) =>
    collection(db, 'artifacts', appId, 'public', 'data', name);
  const baseDoc = (name, id) =>
    doc(db, 'artifacts', appId, 'public', 'data', name, id);

  // Save Job (Add or Update) + Auto-record deposit if new
  const handleSaveJob = async (formData) => {
    if (!user) return;
    try {
      let customerId = formData.customerId;
      // Create customer on the fly if not selected from existing
      if (!customerId && formData.customerName) {
        const newCust = await addDoc(baseCol('customers'), {
          name: formData.customerName.trim(),
          phone: formData.customerPhone.trim(),
          address: formData.location.trim(),
          note: '',
          createdAt: todayISO,
        });
        customerId = newCust.id;
      }

      const techObj = technicians.find((t) => t.id === formData.techId);
      const totalAmount = Number(formData.totalAmount) || 0;
      const depositAmount = Number(formData.depositAmount) || 0;
      const paidAmount = formData.id
        ? Number(formData.paidAmount) || 0
        : depositAmount;

      const isCompleted = formData.status === 'เสร็จสิ้น';
      const completedDate = isCompleted
        ? formData.completedDate || todayISO
        : formData.completedDate || '';
      const warrantyYears = Number(formData.warrantyYears) || 1;
      const warrantyExpiry = isCompleted
        ? addYearsToDate(completedDate, warrantyYears)
        : '';

      const payload = {
        jobCode:
          formData.jobCode ||
          `JOB-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId: customerId || '',
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        location: formData.location.trim(),
        date: formData.date,
        time: formData.time || '09:00',
        details: formData.details.trim(),
        totalAmount,
        depositAmount,
        paidAmount,
        techId: formData.techId || '',
        techName: techObj ? techObj.name : formData.techName || 'ยังไม่ระบุช่าง',
        helperCount: Number(formData.helperCount) || 0,
        status: formData.status || 'รอดำเนินการ',
        warrantyYears,
        completedDate,
        warrantyExpiry,
        issueNote: formData.issueNote || '',
      };

      if (formData.id) {
        await updateDoc(baseDoc('jobs', formData.id), payload);
        showToast('อัปเดตข้อมูลคิวงานเรียบร้อย');
      } else {
        const createdJob = await addDoc(baseCol('jobs'), payload);
        // If deposit > 0 on new job, also record in Incomes automatically
        if (depositAmount > 0) {
          await addDoc(baseCol('incomes'), {
            date: todayISO,
            jobId: createdJob.id,
            jobCode: payload.jobCode,
            customerName: payload.customerName,
            type: depositAmount >= totalAmount ? 'ปิดงานเต็มจำนวน' : 'มัดจำ',
            method: formData.paymentMethod || 'โอนเงิน',
            amount: depositAmount,
            note: 'บันทึกอัตโนมัติจากคิวงานใหม่',
          });
        }
        showToast('เพิ่มคิวงานใหม่สำเร็จ!');
      }
      setJobModal({ open: false, data: null });
    } catch (err) {
      console.error('Save job error:', err);
      showToast('ไม่สามารถบันทึกคิวงานได้', 'error');
    }
  };

  // Quick Job Status Update (Used by Technicians & Dispatch Board)
  const handleQuickJobStatus = async (job, newStatus) => {
    if (!user) return;
    try {
      const updates = { status: newStatus };
      if (newStatus === 'เสร็จสิ้น') {
        const compDate = todayISO;
        updates.completedDate = compDate;
        updates.warrantyExpiry = addYearsToDate(
          compDate,
          job.warrantyYears || 1
        );
      }
      await updateDoc(baseDoc('jobs', job.id), updates);
      showToast(`อัปเดตสถานะงาน ${job.jobCode} เป็น "${newStatus}"`);
    } catch (err) {
      console.error(err);
      showToast('อัปเดตสถานะไม่สำเร็จ', 'error');
    }
  };

  // Record Income Payment & Update Job Paid Amount
  const handleSaveIncome = async (formData) => {
    if (!user) return;
    try {
      const amount = Number(formData.amount) || 0;
      if (amount <= 0) {
        showToast('กรุณาระบุจำนวนเงินให้ถูกต้อง', 'error');
        return;
      }

      const linkedJob = jobs.find((j) => j.id === formData.jobId);

      await addDoc(baseCol('incomes'), {
        date: formData.date || todayISO,
        jobId: linkedJob ? linkedJob.id : '',
        jobCode: linkedJob ? linkedJob.jobCode : 'ทั่วไป',
        customerName: linkedJob
          ? linkedJob.customerName
          : formData.customerName || 'ลูกค้าทั่วไป',
        type: formData.type,
        method: formData.method,
        amount,
        note: formData.note || '',
      });

      if (linkedJob) {
        const newPaid = (Number(linkedJob.paidAmount) || 0) + amount;
        await updateDoc(baseDoc('jobs', linkedJob.id), {
          paidAmount: newPaid,
        });
      }

      showToast(`บันทึกรายรับ ฿${formatCurrency(amount)} เรียบร้อย`);
      setIncomeModal({ open: false, job: null, defaultType: 'ชำระส่วนที่เหลือ' });
    } catch (err) {
      console.error(err);
      showToast('บันทึกรายรับไม่สำเร็จ', 'error');
    }
  };

  // Save Expense
  const handleSaveExpense = async (formData) => {
    if (!user) return;
    try {
      const payload = {
        date: formData.date || todayISO,
        category: formData.category,
        description: formData.description.trim(),
        amount: Number(formData.amount) || 0,
        staff: formData.staff.trim() || 'เจ้าของร้าน',
      };
      if (formData.id) {
        await updateDoc(baseDoc('expenses', formData.id), payload);
        showToast('แก้ไขรายการรายจ่ายแล้ว');
      } else {
        await addDoc(baseCol('expenses'), payload);
        showToast('บันทึกรายจ่ายเรียบร้อย');
      }
      setExpenseModal({ open: false, data: null });
    } catch (err) {
      console.error(err);
      showToast('บันทึกรายจ่ายไม่สำเร็จ', 'error');
    }
  };

  // Save Customer
  const handleSaveCustomer = async (formData) => {
    if (!user) return;
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        note: formData.note.trim(),
        createdAt: formData.createdAt || todayISO,
      };
      if (formData.id) {
        await updateDoc(baseDoc('customers', formData.id), payload);
        showToast('อัปเดตข้อมูลลูกค้าแล้ว');
      } else {
        await addDoc(baseCol('customers'), payload);
        showToast('เพิ่มลูกค้าใหม่เรียบร้อย');
      }
      setCustomerModal({ open: false, data: null });
    } catch (err) {
      console.error(err);
      showToast('บันทึกข้อมูลลูกค้าไม่สำเร็จ', 'error');
    }
  };

  // Save Technician
  const handleSaveTechnician = async (formData) => {
    if (!user) return;
    try {
      const payload = {
        name: formData.name.trim(),
        role: formData.role.trim() || 'ช่างติดตั้ง',
        phone: formData.phone.trim(),
        status: formData.status || 'พร้อมปฏิบัติงาน',
      };
      if (formData.id) {
        await updateDoc(baseDoc('technicians', formData.id), payload);
        showToast('แก้ไขข้อมูลช่างเรียบร้อย');
      } else {
        await addDoc(baseCol('technicians'), payload);
        showToast('เพิ่มรายชื่อช่างใหม่แล้ว');
      }
      setTechModal({ open: false, data: null });
    } catch (err) {
      console.error(err);
      showToast('บันทึกข้อมูลช่างไม่สำเร็จ', 'error');
    }
  };

  // Save Inventory Item
  const handleSaveInventory = async (formData) => {
    if (!user) return;
    try {
      const payload = {
        sku: formData.sku.trim() || `MAT-${Math.floor(100 + Math.random() * 900)}`,
        name: formData.name.trim(),
        category: formData.category,
        qty: Number(formData.qty) || 0,
        unit: formData.unit.trim() || 'ชิ้น',
        minStock: Number(formData.minStock) || 5,
      };
      if (formData.id) {
        await updateDoc(baseDoc('inventory', formData.id), payload);
        showToast('อัปเดตข้อมูลสต็อกสินค้าแล้ว');
      } else {
        await addDoc(baseCol('inventory'), payload);
        showToast('เพิ่มรายการสินค้าในสต็อกแล้ว');
      }
      setInventoryModal({ open: false, data: null });
    } catch (err) {
      console.error(err);
      showToast('บันทึกสต็อกไม่สำเร็จ', 'error');
    }
  };

  // Quick Stock In / Out
  const handleAdjustStock = async (item, mode, deltaQty) => {
    if (!user) return;
    const change = Number(deltaQty) || 0;
    if (change <= 0) return;
    try {
      const currentQty = Number(item.qty) || 0;
      const newQty =
        mode === 'in' ? currentQty + change : Math.max(0, currentQty - change);
      await updateDoc(baseDoc('inventory', item.id), { qty: newQty });
      showToast(
        `${mode === 'in' ? 'รับเข้า' : 'เบิกใช้'} "${item.name}" จำนวน ${change} ${item.unit} (คงเหลือ ${newQty})`
      );
      setStockAdjustModal({ open: false, item: null, mode: 'out' });
    } catch (err) {
      console.error(err);
      showToast('อัปเดตจำนวนสต็อกไม่สำเร็จ', 'error');
    }
  };

  // Save Issue Note
  const handleSaveIssue = async (job, issueNote, resolve) => {
    if (!user) return;
    try {
      await updateDoc(baseDoc('jobs', job.id), {
        status: resolve ? 'กำลังทำ' : 'มีปัญหา',
        issueNote: resolve ? '' : issueNote,
      });
      showToast(
        resolve
          ? 'แก้ไขปัญหาเรียบร้อย เปลี่ยนสถานะเป็นกำลังทำ'
          : 'บันทึกแจ้งปัญหางานเรียบร้อย'
      );
      setIssueModal({ open: false, job: null });
    } catch (err) {
      console.error(err);
      showToast('บันทึกข้อมูลไม่สำเร็จ', 'error');
    }
  };

  // --------------------------------------------------------------------------
  // NAVIGATION MENU CONFIGURATION (ALL 10 REQUESTED MODULES)
  // --------------------------------------------------------------------------
  const menuItems = [
    { id: 'dashboard', label: 'หน้าภาพรวม', icon: Home },
    {
      id: 'schedule',
      label: 'ตารางคิวงาน',
      icon: Calendar,
      badge: metrics.todaysJobs.length || null,
      badgeColor: 'bg-blue-500',
    },
    { id: 'dispatch', label: 'จ่ายงานช่าง', icon: HardHat },
    { id: 'customers', label: 'ฐานข้อมูลลูกค้า', icon: Users },
    {
      id: 'income',
      label: 'รายรับ',
      icon: Wallet,
      badge: metrics.unpaidJobs.length || null,
      badgeColor: 'bg-rose-500',
    },
    { id: 'expenses', label: 'รายจ่าย', icon: Receipt },
    {
      id: 'inventory',
      label: 'สต็อกสินค้า',
      icon: Package,
      badge: metrics.lowStockItems.length || null,
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'history',
      label: 'ประวัติงาน',
      icon: Wrench,
      badge: metrics.issueJobs.length || null,
      badgeColor: 'bg-rose-500',
    },
    { id: 'warranty', label: 'รับประกันงาน', icon: ShieldCheck },
    { id: 'reports', label: 'รายงานกำไร', icon: BarChart3 },
  ];

  // ==========================================================================
  // RENDER UI
  // ==========================================================================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col md:flex-row font-sans selection:bg-blue-100">
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-white font-medium text-sm transition-all animate-bounce ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-900'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-200 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* SIDEBAR NAVIGATION (TABLET LANDSCAPE & DESKTOP) */}
      <aside className="hidden md:flex md:w-64 lg:w-72 bg-slate-900 text-slate-100 flex-col shrink-0 shadow-2xl z-20">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-white">
                มุ้งลวดโปร ERP
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                ระบบบริหารร้าน & ทีมช่าง
              </p>
            </div>
          </div>

          {/* Sync Status Pill */}
          <div className="mt-4 flex items-center justify-between bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700/60">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-400 animate-pulse'
                    : syncStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-xs font-medium text-slate-300">
                {syncStatus === 'synced'
                  ? 'ซิงก์ข้อมูลออนไลน์แล้ว'
                  : syncStatus === 'error'
                  ? 'การเชื่อมต่อขัดข้อง'
                  : 'กำลังเชื่อมต่อ...'}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              LIVE
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-left font-medium transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800/90 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon
                    className={`w-5 h-5 ${
                      active ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                  <span className="text-sm">{item.label}</span>
                </div>
                {item.badge ? (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
                      active ? 'bg-white/25' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Bottom Demo Data Seeder */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleSeedDemoData}
            disabled={seeding}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>
              {seeding ? 'กำลังสร้างข้อมูล...' : 'โหลดข้อมูลตัวอย่างทดสอบ'}
            </span>
          </button>
        </div>
      </aside>

      {/* MOBILE / TABLET PORTRAIT DRAWER MENU */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 text-white flex flex-col h-full shadow-2xl z-10">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-sm">มุ้งลวดโปร ERP</div>
                  <div className="text-[11px] text-emerald-400">
                    ● ซิงก์ข้อมูลเรียลไทม์
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-medium ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800">
              <button
                onClick={() => {
                  handleSeedDemoData();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-3 rounded-xl bg-slate-800 text-xs font-medium text-amber-300 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                โหลดข้อมูลตัวอย่างทดสอบ
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER BAR */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
              aria-label="เปิดเมนู"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-lg lg:text-xl font-bold text-slate-900">
                {menuItems.find((m) => m.id === activeTab)?.label}
              </h2>
              <p className="text-xs text-slate-500">
                วันนี้: {formatThaiDate(todayISO)}
              </p>
            </div>
          </div>

          {/* Role Switcher & Quick Add */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Role Mode Switcher (Owner on Tablet vs Technician on Mobile) */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setUserRole('owner')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  userRole === 'owner'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Tablet className="w-3.5 h-3.5 text-blue-600" />
                <span>เจ้าของร้าน</span>
              </button>
              <button
                onClick={() => {
                  setUserRole('technician');
                  setActiveTab('dispatch');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  userRole === 'technician'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>ช่างหน้างาน</span>
              </button>
            </div>

            {userRole === 'owner' && (
              <button
                onClick={() => setJobModal({ open: true, data: null })}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-blue-600/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">เพิ่มคิวงานใหม่</span>
                <span className="sm:hidden">คิวงาน</span>
              </button>
            )}
          </div>
        </header>

        {/* EMPTY STATE BANNER WHEN DATABASE HAS NO DATA */}
        {jobs.length === 0 && customers.length === 0 && (
          <div className="mx-4 lg:mx-8 mt-5 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                ยินดีต้อนรับสู่ระบบบริหารร้านมุ้งลวดออนไลน์!
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-1">
                ยังไม่มีข้อมูลในระบบ คุณสามารถกดปุ่มด้านขวาเพื่อโหลดข้อมูลตัวอย่าง
                (คิวงาน ช่าง ลูกค้า สต็อก รายรับ-รายจ่าย)
                เพื่อทดลองใช้งานบนแท็บเล็ตและมือถือได้ทันที
              </p>
            </div>
            <button
              onClick={handleSeedDemoData}
              disabled={seeding}
              className="bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm px-5 py-3 rounded-xl shadow shrink-0 transition"
            >
              {seeding ? 'กำลังโหลดข้อมูล...' : '+ โหลดข้อมูลตัวอย่างทันที'}
            </button>
          </div>
        )}

        {/* DYNAMIC MODULE VIEWPORT */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6 pb-24 md:pb-10">
          {activeTab === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              jobs={jobs}
              technicians={technicians}
              todayISO={todayISO}
              setActiveTab={setActiveTab}
              onOpenJobModal={(job) => setJobModal({ open: true, data: job })}
              onOpenIncomeModal={(job) =>
                setIncomeModal({
                  open: true,
                  job,
                  defaultType: 'ชำระส่วนที่เหลือ',
                })
              }
              onOpenExpenseModal={() =>
                setExpenseModal({ open: true, data: null })
              }
              onSelectCustomer={(customerId) => {
                const c = customers.find((x) => x.id === customerId);
                if (c) setCustomerDrawer({ open: true, customer: c });
              }}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleView
              jobs={jobs}
              todayISO={todayISO}
              onOpenJobModal={(job) => setJobModal({ open: true, data: job })}
              onQuickStatus={handleQuickJobStatus}
              onOpenIncomeModal={(job) =>
                setIncomeModal({
                  open: true,
                  job,
                  defaultType: 'ชำระส่วนที่เหลือ',
                })
              }
              onSelectCustomer={(customerId) => {
                const c = customers.find((x) => x.id === customerId);
                if (c) setCustomerDrawer({ open: true, customer: c });
              }}
            />
          )}

          {activeTab === 'dispatch' && (
            <DispatchView
              jobs={jobs}
              technicians={technicians}
              todayISO={todayISO}
              userRole={userRole}
              selectedTechFilter={selectedTechFilter}
              setSelectedTechFilter={setSelectedTechFilter}
              onQuickStatus={handleQuickJobStatus}
              onOpenIssueModal={(job) => setIssueModal({ open: true, job })}
              onOpenTechModal={(tech) =>
                setTechModal({ open: true, data: tech })
              }
              onOpenJobModal={(job) => setJobModal({ open: true, data: job })}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              customers={customers}
              jobs={jobs}
              onOpenCustomerModal={(c) =>
                setCustomerModal({ open: true, data: c })
              }
              onOpenCustomerDrawer={(c) =>
                setCustomerDrawer({ open: true, customer: c })
              }
            />
          )}

          {activeTab === 'income' && (
            <IncomeView
              incomes={incomes}
              unpaidJobs={metrics.unpaidJobs}
              onOpenIncomeModal={(job, type) =>
                setIncomeModal({
                  open: true,
                  job: job || null,
                  defaultType: type || 'ชำระส่วนที่เหลือ',
                })
              }
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              expenses={expenses}
              onOpenExpenseModal={(exp) =>
                setExpenseModal({ open: true, data: exp })
              }
              onDeleteExpense={async (id) => {
                await deleteDoc(baseDoc('expenses', id));
                showToast('ลบรายการรายจ่ายแล้ว');
              }}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              inventory={inventory}
              onOpenInventoryModal={(item) =>
                setInventoryModal({ open: true, data: item })
              }
              onOpenAdjustModal={(item, mode) =>
                setStockAdjustModal({ open: true, item, mode })
              }
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              jobs={jobs}
              onOpenIssueModal={(job) => setIssueModal({ open: true, job })}
              onResolveIssue={(job) => handleSaveIssue(job, '', true)}
              onOpenJobModal={(job) => setJobModal({ open: true, data: job })}
            />
          )}

          {activeTab === 'warranty' && (
            <WarrantyView
              jobs={jobs}
              onSelectCustomer={(customerId) => {
                const c = customers.find((x) => x.id === customerId);
                if (c) setCustomerDrawer({ open: true, customer: c });
              }}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView incomes={incomes} expenses={expenses} jobs={jobs} />
          )}
        </main>
      </div>

      {/* ==================================================================== */}
      {/* MODALS & DRAWERS */}
      {/* ==================================================================== */}

      {/* 1. ADD / EDIT JOB MODAL */}
      {jobModal.open && (
        <JobFormModal
          initialData={jobModal.data}
          customers={customers}
          technicians={technicians}
          todayISO={todayISO}
          onClose={() => setJobModal({ open: false, data: null })}
          onSave={handleSaveJob}
        />
      )}

      {/* 2. CUSTOMER PROFILE DRAWER (FULL HISTORY & WARRANTY) */}
      {customerDrawer.open && customerDrawer.customer && (
        <CustomerProfileDrawer
          customer={customerDrawer.customer}
          jobs={jobs.filter(
            (j) =>
              j.customerId === customerDrawer.customer.id ||
              j.customerName === customerDrawer.customer.name
          )}
          onClose={() => setCustomerDrawer({ open: false, customer: null })}
          onEditCustomer={(c) => {
            setCustomerDrawer({ open: false, customer: null });
            setCustomerModal({ open: true, data: c });
          }}
          onAddJobForCustomer={(c) => {
            setCustomerDrawer({ open: false, customer: null });
            setJobModal({
              open: true,
              data: {
                customerId: c.id,
                customerName: c.name,
                customerPhone: c.phone,
                location: c.address,
              },
            });
          }}
        />
      )}

      {/* 3. ADD / EDIT CUSTOMER MODAL */}
      {customerModal.open && (
        <CustomerFormModal
          initialData={customerModal.data}
          onClose={() => setCustomerModal({ open: false, data: null })}
          onSave={handleSaveCustomer}
        />
      )}

      {/* 4. ADD / EDIT TECHNICIAN MODAL */}
      {techModal.open && (
        <TechnicianFormModal
          initialData={techModal.data}
          onClose={() => setTechModal({ open: false, data: null })}
          onSave={handleSaveTechnician}
        />
      )}

      {/* 5. RECORD INCOME / PAYMENT MODAL */}
      {incomeModal.open && (
        <IncomeFormModal
          linkedJob={incomeModal.job}
          defaultType={incomeModal.defaultType}
          jobs={jobs}
          todayISO={todayISO}
          onClose={() =>
            setIncomeModal({ open: false, job: null, defaultType: 'ชำระส่วนที่เหลือ' })
          }
          onSave={handleSaveIncome}
        />
      )}

      {/* 6. RECORD EXPENSE MODAL */}
      {expenseModal.open && (
        <ExpenseFormModal
          initialData={expenseModal.data}
          todayISO={todayISO}
          onClose={() => setExpenseModal({ open: false, data: null })}
          onSave={handleSaveExpense}
        />
      )}

      {/* 7. INVENTORY ITEM MODAL */}
      {inventoryModal.open && (
        <InventoryFormModal
          initialData={inventoryModal.data}
          onClose={() => setInventoryModal({ open: false, data: null })}
          onSave={handleSaveInventory}
        />
      )}

      {/* 8. STOCK IN / OUT ADJUSTMENT MODAL */}
      {stockAdjustModal.open && stockAdjustModal.item && (
        <StockAdjustModal
          item={stockAdjustModal.item}
          mode={stockAdjustModal.mode}
          onClose={() =>
            setStockAdjustModal({ open: false, item: null, mode: 'out' })
          }
          onConfirm={handleAdjustStock}
        />
      )}

      {/* 9. ISSUE REPORT MODAL */}
      {issueModal.open && issueModal.job && (
        <IssueReportModal
          job={issueModal.job}
          onClose={() => setIssueModal({ open: false, job: null })}
          onSave={handleSaveIssue}
        />
      )}
    </div>
  );
}

// ============================================================================
// STATUS BADGE HELPER COMPONENT
// ============================================================================
function StatusBadge({ status }) {
  const styles = {
    รอดำเนินการ: 'bg-slate-100 text-slate-700 border-slate-200',
    กำลังเดินทาง: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    กำลังทำ: 'bg-blue-50 text-blue-700 border-blue-200',
    เสร็จสิ้น: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    มีปัญหา: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
        styles[status] || styles['รอดำเนินการ']
      }`}
    >
      {status}
    </span>
  );
}

// ============================================================================
// MODULE 1: DASHBOARD VIEW (หน้าภาพรวม)
// ============================================================================
function DashboardView({
  metrics,
  technicians,
  todayISO,
  setActiveTab,
  onOpenJobModal,
  onOpenIncomeModal,
  onOpenExpenseModal,
  onSelectCustomer,
}) {
  return (
    <div className="space-y-6">
      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('reports')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              รายรับเดือนนี้
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl lg:text-3xl font-extrabold text-slate-900">
            ฿{formatCurrency(metrics.monthlyIncome)}
          </div>
          <div className="mt-1.5 text-xs text-emerald-600 font-medium">
            กำไรสุทธิเดือนนี้: ฿{formatCurrency(metrics.monthlyProfit)}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('schedule')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              คิวงานวันนี้
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl lg:text-3xl font-extrabold text-slate-900">
            {metrics.todaysJobs.length} <span className="text-base font-semibold">งาน</span>
          </div>
          <div className="mt-1.5 text-xs text-blue-600 font-medium">
            ทีมช่างออกปฏิบัติงาน {technicians.length} คน
          </div>
        </div>

        <div
          onClick={() => setActiveTab('income')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              ยอดค้างชำระ (ยังไม่ปิดงาน)
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl lg:text-3xl font-extrabold text-rose-600">
            ฿{formatCurrency(metrics.totalUnpaidBalance)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-medium">
            จากทั้งหมด {metrics.unpaidJobs.length} งานที่รอเก็บเงิน
          </div>
        </div>

        <div
          onClick={() => setActiveTab('inventory')}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              แจ้งเตือนสต็อกใกล้หมด
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl lg:text-3xl font-extrabold text-amber-600">
            {metrics.lowStockItems.length}{' '}
            <span className="text-base font-semibold">รายการ</span>
          </div>
          <div className="mt-1.5 text-xs text-amber-700 font-medium">
            {metrics.lowStockItems.length > 0
              ? 'ควรสั่งวัสดุเพิ่มเติม'
              : 'สต็อกวัสดุเพียงพอ'}
          </div>
        </div>
      </div>

      {/* QUICK ACTION BAR FOR TABLET */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onOpenJobModal(null)}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-4 rounded-xl font-semibold text-sm shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>จดคิวงานใหม่</span>
        </button>
        <button
          onClick={() => setActiveTab('dispatch')}
          className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-3.5 px-4 rounded-xl font-semibold text-sm shadow-sm transition"
        >
          <HardHat className="w-4 h-4 text-amber-400" />
          <span>เช็กตารางช่างวันนี้</span>
        </button>
        <button
          onClick={() => onOpenIncomeModal(null)}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 px-4 rounded-xl font-semibold text-sm shadow-sm transition"
        >
          <ArrowDownRight className="w-4 h-4" />
          <span>บันทึกรายรับ</span>
        </button>
        <button
          onClick={onOpenExpenseModal}
          className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 py-3.5 px-4 rounded-xl font-semibold text-sm shadow-sm transition"
        >
          <ArrowUpRight className="w-4 h-4 text-rose-500" />
          <span>บันทึกรายจ่าย</span>
        </button>
      </div>

      {/* MAIN 2-COLUMN GRID: TODAY'S DISPATCH & ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2 COLS: TODAY'S TECHNICIAN DISPATCH */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <HardHat className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900">
                ตารางจ่ายงานช่างวันนี้ ({formatThaiDate(todayISO)})
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('dispatch')}
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              ดูทั้งหมด <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {metrics.todaysJobs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                ยังไม่มีคิวงานติดตั้งสำหรับวันนี้
              </div>
            ) : (
              metrics.todaysJobs.map((job) => {
                const balance =
                  (Number(job.totalAmount) || 0) - (Number(job.paidAmount) || 0);
                return (
                  <div
                    key={job.id}
                    className="p-5 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-blue-50 text-blue-700 font-bold text-xs px-2.5 py-1 rounded-lg">
                          ⏰ {job.time} น.
                        </span>
                        <span className="font-bold text-slate-900">
                          {job.techName || 'ยังไม่ระบุช่าง'}
                        </span>
                        {Number(job.helperCount) > 0 && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                            + ผู้ช่วย {job.helperCount} คน
                          </span>
                        )}
                        <StatusBadge status={job.status} />
                      </div>
                      <div className="text-sm font-semibold text-slate-800">
                        ลูกค้า:{' '}
                        <button
                          onClick={() => onSelectCustomer(job.customerId)}
                          className="text-blue-600 hover:underline"
                        >
                          {job.customerName}
                        </button>{' '}
                        <span className="text-slate-400 font-normal">
                          ({job.customerPhone})
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-start gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span>{job.location}</span>
                      </div>
                      <div className="text-xs text-slate-600 bg-slate-100/80 p-2 rounded-lg">
                        {job.details}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-end justify-between gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">ยอดรวมงาน</div>
                        <div className="font-bold text-slate-900">
                          ฿{formatCurrency(job.totalAmount)}
                        </div>
                        {balance > 0 ? (
                          <div className="text-xs font-bold text-rose-600">
                            ค้างชำระ ฿{formatCurrency(balance)}
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-emerald-600">
                            ชำระครบแล้ว
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onOpenJobModal(job)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                      >
                        รายละเอียด
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COL: UNPAID BALANCES & LOW STOCK ALERTS */}
        <div className="space-y-6">
          {/* Unpaid Jobs Alert Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>งานที่ยังไม่เก็บเงิน / ค้างยอด</span>
              </div>
              <span className="text-xs font-bold bg-rose-600 text-white px-2 py-0.5 rounded-full">
                {metrics.unpaidJobs.length}
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {metrics.unpaidJobs.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-400">
                  ไม่มีรายการค้างชำระ
                </div>
              ) : (
                metrics.unpaidJobs.slice(0, 5).map((job) => {
                  const bal =
                    (Number(job.totalAmount) || 0) -
                    (Number(job.paidAmount) || 0);
                  return (
                    <div
                      key={job.id}
                      className="p-3.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 truncate">
                          {job.customerName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {job.jobCode} • {formatThaiDate(job.date)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-extrabold text-rose-600">
                          ฿{formatCurrency(bal)}
                        </span>
                        <button
                          onClick={() => onOpenIncomeModal(job)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                        >
                          รับเงิน
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Low Stock Alert Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-amber-50/80 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>สินค้าใกล้หมดสต็อก</span>
              </div>
              <button
                onClick={() => setActiveTab('inventory')}
                className="text-xs font-semibold text-amber-700 hover:underline"
              >
                จัดการสต็อก
              </button>
            </div>
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {metrics.lowStockItems.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-400">
                  สินค้าทุกรายการมีเพียงพอ
                </div>
              ) : (
                metrics.lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-800 truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        ขั้นต่ำ {item.minStock} {item.unit}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-extrabold shrink-0">
                      เหลือ {item.qty} {item.unit}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODULE 2: JOB SCHEDULE VIEW (ตารางคิวงาน)
// ============================================================================
function ScheduleView({
  jobs,
  todayISO,
  onOpenJobModal,
  onQuickStatus,
  onOpenIncomeModal,
  onSelectCustomer,
}) {
  const [dateFilter, setDateFilter] = useState('all'); // 'today' | 'tomorrow' | 'all' | 'custom'
  const [customDate, setCustomDate] = useState(todayISO);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const tomorrowISO = getOffsetDateISO(1);

  const filteredJobs = useMemo(() => {
    return jobs
      .filter((j) => {
        if (dateFilter === 'today' && j.date !== todayISO) return false;
        if (dateFilter === 'tomorrow' && j.date !== tomorrowISO) return false;
        if (dateFilter === 'custom' && j.date !== customDate) return false;
        if (statusFilter !== 'all' && j.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            (j.customerName || '').toLowerCase().includes(q) ||
            (j.customerPhone || '').includes(q) ||
            (j.location || '').toLowerCase().includes(q) ||
            (j.jobCode || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [
    jobs,
    dateFilter,
    customDate,
    statusFilter,
    searchQuery,
    todayISO,
    tomorrowISO,
  ]);

  return (
    <div className="space-y-5">
      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Date Quick Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'คิวงานทั้งหมด' },
              { id: 'today', label: 'วันนี้' },
              { id: 'tomorrow', label: 'พรุ่งนี้' },
              { id: 'custom', label: 'เลือกวันที่' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                  dateFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {dateFilter === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold"
              />
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, หมู่บ้าน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-slate-400 shrink-0">
            สถานะ:
          </span>
          {['all', 'รอดำเนินการ', 'กำลังทำ', 'เสร็จสิ้น', 'มีปัญหา'].map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 border ${
                  statusFilter === st
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {st === 'all' ? 'ทุกสถานะ' : st}
              </button>
            )
          )}
        </div>
      </div>

      {/* JOB CARDS LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredJobs.length === 0 ? (
          <div className="col-span-full bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400">
            ไม่พบรายการคิวงานที่ค้นหา
          </div>
        ) : (
          filteredJobs.map((job) => {
            const total = Number(job.totalAmount) || 0;
            const paid = Number(job.paidAmount) || 0;
            const remaining = total - paid;
            return (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between gap-4 hover:border-blue-300 transition"
              >
                <div className="space-y-3">
                  {/* Top Meta */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {job.jobCode}
                      </span>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                        📅 {formatThaiDate(job.date)} • {job.time} น.
                      </span>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>

                  {/* Customer Info */}
                  <div>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onSelectCustomer(job.customerId)}
                        className="text-base font-bold text-slate-900 hover:text-blue-600 text-left"
                      >
                        {job.customerName}
                      </button>
                      <a
                        href={`tel:${job.customerPhone}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {job.customerPhone}
                      </a>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>{job.location}</span>
                    </p>
                  </div>

                  {/* Job Scope */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed">
                    <span className="font-bold text-slate-900">รายละเอียด: </span>
                    {job.details}
                  </div>

                  {/* Assigned Tech */}
                  <div className="flex items-center justify-between text-xs bg-indigo-50/60 px-3 py-2 rounded-xl">
                    <span className="text-slate-600">ทีมช่างรับผิดชอบ:</span>
                    <span className="font-bold text-indigo-900">
                      👷 {job.techName || 'ยังไม่จ่ายงาน'}{' '}
                      {Number(job.helperCount) > 0
                        ? `(ผู้ช่วย ${job.helperCount} คน)`
                        : ''}
                    </span>
                  </div>
                </div>

                {/* Bottom Financials & Actions */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block">ยอดรวม</span>
                      <span className="font-bold text-slate-900 text-sm">
                        ฿{formatCurrency(total)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">จ่ายแล้ว</span>
                      <span className="font-bold text-emerald-600 text-sm">
                        ฿{formatCurrency(paid)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">คงเหลือ</span>
                      <span
                        className={`font-extrabold text-sm ${
                          remaining > 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}
                      >
                        ฿{formatCurrency(remaining)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {remaining > 0 && (
                      <button
                        onClick={() => onOpenIncomeModal(job)}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        รับเงิน
                      </button>
                    )}
                    {job.status !== 'เสร็จสิ้น' && (
                      <button
                        onClick={() => onQuickStatus(job, 'เสร็จสิ้น')}
                        className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold"
                      >
                        ปิดงานเสร็จ
                      </button>
                    )}
                    <button
                      onClick={() => onOpenJobModal(job)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                      title="แก้ไขคิวงาน"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MODULE 3: TECHNICIAN DISPATCH VIEW (จ่ายงานช่าง & มุมมองช่างหน้างาน)
// ============================================================================
function DispatchView({
  jobs,
  technicians,
  todayISO,
  userRole,
  selectedTechFilter,
  setSelectedTechFilter,
  onQuickStatus,
  onOpenIssueModal,
  onOpenTechModal,
  onOpenJobModal,
}) {
  const [selectedDate, setSelectedDate] = useState(todayISO);

  const dayJobs = useMemo(() => {
    return jobs
      .filter((j) => j.date === selectedDate)
      .filter((j) =>
        selectedTechFilter === 'all' ? true : j.techId === selectedTechFilter
      )
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [jobs, selectedDate, selectedTechFilter]);

  return (
    <div className="space-y-6">
      {/* TOP CONTROLS: DATE SELECTOR & TECHNICIAN FILTER */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedDate(todayISO)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
              selectedDate === todayISO
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            วันนี้
          </button>
          <button
            onClick={() => setSelectedDate(getOffsetDateISO(1))}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
              selectedDate === getOffsetDateISO(1)
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            พรุ่งนี้
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedTechFilter}
            onChange={(e) => setSelectedTechFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold bg-white"
          >
            <option value="all">👷 แสดงช่างทุกคน ({technicians.length})</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {userRole === 'owner' && (
            <button
              onClick={() => onOpenTechModal(null)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มช่าง</span>
            </button>
          )}
        </div>
      </div>

      {/* TECHNICIAN ROSTER SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {technicians.map((tech) => {
          const techJobs = jobs.filter(
            (j) => j.date === selectedDate && j.techId === tech.id
          );
          return (
            <div
              key={tech.id}
              onClick={() =>
                setSelectedTechFilter(
                  selectedTechFilter === tech.id ? 'all' : tech.id
                )
              }
              className={`bg-white p-4 rounded-2xl border transition cursor-pointer ${
                selectedTechFilter === tech.id
                  ? 'border-blue-600 ring-2 ring-blue-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base">
                    {tech.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      {tech.name}
                    </h4>
                    <p className="text-xs text-slate-500">{tech.role}</p>
                    <p className="text-xs text-blue-600 font-medium mt-0.5">
                      📞 {tech.phone}
                    </p>
                  </div>
                </div>
                {userRole === 'owner' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTechModal(tech);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  งานวันที่ {formatThaiDate(selectedDate)}:
                </span>
                <span
                  className={`font-extrabold px-2.5 py-0.5 rounded-full ${
                    techJobs.length > 0
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {techJobs.length} คิวงาน
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* DAILY DISPATCH BOARD (TOUCH-FRIENDLY FOR FIELD TECHNICIANS) */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <span>
            รายการงานที่จ่ายให้ช่าง — วันที่ {formatThaiDate(selectedDate)}
          </span>
        </h3>

        {dayJobs.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
            ไม่มีคิวงานในวันที่เลือก
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {dayJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-900 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                        {job.time} น.
                      </span>
                      <span className="font-bold text-blue-700 text-sm">
                        👷 {job.techName}
                      </span>
                      {Number(job.helperCount) > 0 && (
                        <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg font-bold">
                          + ผู้ช่วย {job.helperCount} คน
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-base mt-2">
                      ลูกค้า: {job.customerName}
                    </h4>
                  </div>
                  <StatusBadge status={job.status} />
                </div>

                {/* Location & Quick Call / Map */}
                <div className="bg-slate-50 p-3.5 rounded-xl space-y-2 border border-slate-100">
                  <div className="text-xs text-slate-700 flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span className="font-medium">{job.location}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={`tel:${job.customerPhone}`}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      โทรหาลูกค้า ({job.customerPhone})
                    </a>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        job.location
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl"
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-600" />
                      เปิดแผนที่นำทาง
                    </a>
                  </div>
                </div>

                {/* Work Details */}
                <div className="text-xs text-slate-700">
                  <span className="font-bold text-slate-900">รายการติดตั้ง: </span>
                  {job.details}
                </div>

                {job.issueNote && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-medium">
                    ⚠️ หมายเหตุปัญหา: {job.issueNote}
                  </div>
                )}

                {/* Touch Status Action Buttons for Technicians */}
                <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onQuickStatus(job, 'กำลังทำ')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition ${
                      job.status === 'กำลังทำ'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    🔧 กำลังติดตั้ง
                  </button>
                  <button
                    onClick={() => onQuickStatus(job, 'เสร็จสิ้น')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition ${
                      job.status === 'เสร็จสิ้น'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    ✅ ติดตั้งเสร็จ
                  </button>
                  <button
                    onClick={() => onOpenIssueModal(job)}
                    className="py-2.5 px-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                  >
                    ⚠️ แจ้งปัญหา
                  </button>
                </div>

                {userRole === 'owner' && (
                  <div className="text-right">
                    <button
                      onClick={() => onOpenJobModal(job)}
                      className="text-xs font-semibold text-slate-500 hover:text-blue-600"
                    >
                      เปลี่ยนช่าง / แก้ไขเวลา →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MODULE 4: CUSTOMER DATABASE VIEW (ฐานข้อมูลลูกค้า)
// ============================================================================
function CustomersView({
  customers,
  jobs,
  onOpenCustomerModal,
  onOpenCustomerDrawer,
}) {
  const [search, setSearch] = useState('');

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.address || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <div className="space-y-5">
      {/* Header Search & Add */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, หรือหมู่บ้าน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => onOpenCustomerModal(null)}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มลูกค้าใหม่</span>
        </button>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400">
            ไม่พบข้อมูลลูกค้า
          </div>
        ) : (
          filteredCustomers.map((cust) => {
            const custJobs = jobs.filter(
              (j) =>
                j.customerId === cust.id || j.customerName === cust.name
            );
            const totalSpent = custJobs.reduce(
              (sum, j) => sum + (Number(j.totalAmount) || 0),
              0
            );
            return (
              <div
                key={cust.id}
                onClick={() => onOpenCustomerDrawer(cust)}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-900 text-base">
                      {cust.name}
                    </h4>
                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-lg shrink-0">
                      {custJobs.length} งาน
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{cust.phone}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{cust.address}</span>
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    ยอดจ้างงานสะสม:{' '}
                    <strong className="text-slate-800">
                      ฿{formatCurrency(totalSpent)}
                    </strong>
                  </span>
                  <span className="text-blue-600 font-bold flex items-center">
                    ดูประวัติ <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MODULE 5: INCOME & UNPAID TRACKER VIEW (รายรับ & งานค้างชำระ)
// ============================================================================
function IncomeView({ incomes, unpaidJobs, onOpenIncomeModal }) {
  const [tab, setTab] = useState('unpaid'); // 'unpaid' | 'history'

  const totalIncomeAll = incomes.reduce(
    (s, i) => s + (Number(i.amount) || 0),
    0
  );
  const totalUnpaidAll = unpaidJobs.reduce(
    (s, j) => s + ((Number(j.totalAmount) || 0) - (Number(j.paidAmount) || 0)),
    0
  );

  return (
    <div className="space-y-6">
      {/* Top Summary & Action */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500">
              ยอดค้างชำระรอเก็บเงินทั้งหมด
            </div>
            <div className="text-2xl font-extrabold text-rose-600 mt-1">
              ฿{formatCurrency(totalUnpaidAll)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              จำนวน {unpaidJobs.length} งาน
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500">
              ยอดรายรับที่บันทึกแล้วทั้งหมด
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              ฿{formatCurrency(totalIncomeAll)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {incomes.length} รายการรับเงิน
            </div>
          </div>
          <button
            onClick={() => onOpenIncomeModal(null, 'มัดจำ')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>บันทึกรายรับ</span>
          </button>
        </div>
      </div>

      {/* Switcher Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('unpaid')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            tab === 'unpaid'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          งานที่ยังไม่เก็บเงิน / ค้างยอด ({unpaidJobs.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            tab === 'history'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200'
          }`}
        >
          ประวัติการรับเงินทั้งหมด ({incomes.length})
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'unpaid' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {unpaidJobs.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">
                🎉 เยี่ยมมาก! ไม่มีรายการค้างชำระในขณะนี้
              </div>
            ) : (
              unpaidJobs.map((job) => {
                const total = Number(job.totalAmount) || 0;
                const paid = Number(job.paidAmount) || 0;
                const balance = total - paid;
                return (
                  <div
                    key={job.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-slate-100 px-2 py-0.5 rounded">
                          {job.jobCode}
                        </span>
                        <span className="font-bold text-slate-900">
                          {job.customerName}
                        </span>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="text-xs text-slate-500">
                        วันที่นัด: {formatThaiDate(job.date)} • โทร:{' '}
                        {job.customerPhone}
                      </p>
                      <p className="text-xs text-slate-600">{job.details}</p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right text-xs">
                        <div className="text-slate-400">
                          ยอดรวม ฿{formatCurrency(total)} | มัดจำแล้ว ฿
                          {formatCurrency(paid)}
                        </div>
                        <div className="text-base font-extrabold text-rose-600">
                          ค้างชำระ ฿{formatCurrency(balance)}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          onOpenIncomeModal(job, 'ชำระส่วนที่เหลือ')
                        }
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shrink-0"
                      >
                        + บันทึกยอดปิดงาน
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="py-3.5 px-4">วันที่</th>
                <th className="py-3.5 px-4">ลูกค้า / เลขที่งาน</th>
                <th className="py-3.5 px-4">ประเภท</th>
                <th className="py-3.5 px-4">ช่องทาง</th>
                <th className="py-3.5 px-4 text-right">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {[...incomes]
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                .map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                      {formatThaiDate(inc.date)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-xs">
                        {inc.customerName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {inc.jobCode} {inc.note ? `• ${inc.note}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg">
                        {inc.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {inc.method}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-emerald-600">
                      +฿{formatCurrency(inc.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MODULE 6: EXPENSES VIEW (รายจ่าย)
// ============================================================================
function ExpensesView({ expenses, onOpenExpenseModal, onDeleteExpense }) {
  const [catFilter, setCatFilter] = useState('all');

  const categories = [
    'ค่าวัสดุ/อลูมิเนียม/มุ้ง',
    'ค่าแรงช่าง',
    'ค่าน้ำมัน',
    'ค่าเดินทาง/ทางด่วน',
    'ค่าใช้จ่ายอื่นๆ',
  ];

  const filtered = useMemo(() => {
    return expenses
      .filter((e) => (catFilter === 'all' ? true : e.category === catFilter))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [expenses, catFilter]);

  const totalFiltered = filtered.reduce(
    (s, e) => s + (Number(e.amount) || 0),
    0
  );

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-slate-400">
            ยอดรายจ่ายตามตัวกรอง
          </span>
          <div className="text-2xl font-extrabold text-rose-600">
            ฿{formatCurrency(totalFiltered)}
          </div>
        </div>
        <button
          onClick={() => onOpenExpenseModal(null)}
          className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>บันทึกรายจ่ายใหม่</span>
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCatFilter('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 ${
            catFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 border border-slate-200'
          }`}
        >
          ทั้งหมด
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 ${
              catFilter === cat
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500">
              <th className="py-3.5 px-4">วันที่</th>
              <th className="py-3.5 px-4">หมวดหมู่</th>
              <th className="py-3.5 px-4">รายละเอียด</th>
              <th className="py-3.5 px-4">ผู้เบิก</th>
              <th className="py-3.5 px-4 text-right">จำนวนเงิน</th>
              <th className="py-3.5 px-4 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  ไม่พบรายการรายจ่าย
                </td>
              </tr>
            ) : (
              filtered.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                    {formatThaiDate(exp.date)}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg whitespace-nowrap">
                      {exp.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-800">
                    {exp.description}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-500">
                    {exp.staff}
                  </td>
                  <td className="py-3.5 px-4 text-right font-extrabold text-rose-600 whitespace-nowrap">
                    -฿{formatCurrency(exp.amount)}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onOpenExpenseModal(exp)}
                      className="p-1.5 text-slate-400 hover:text-blue-600"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteExpense(exp.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// MODULE 7: INVENTORY VIEW (สต็อกสินค้า & อะไหล่)
// ============================================================================
function InventoryView({
  inventory,
  onOpenInventoryModal,
  onOpenAdjustModal,
}) {
  const [catFilter, setCatFilter] = useState('all');
  const [onlyLow, setOnlyLow] = useState(false);

  const filtered = useMemo(() => {
    return inventory.filter((item) => {
      if (catFilter !== 'all' && item.category !== catFilter) return false;
      if (onlyLow && Number(item.qty) > Number(item.minStock)) return false;
      return true;
    });
  }, [inventory, catFilter, onlyLow]);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {['all', 'อลูมิเนียม', 'มุ้งลวด', 'อุปกรณ์/อะไหล่'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold ${
                catFilter === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {cat === 'all' ? 'ทั้งหมด' : cat}
            </button>
          ))}
          <button
            onClick={() => setOnlyLow(!onlyLow)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${
              onlyLow
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            ⚠️ เฉพาะของใกล้หมด
          </button>
        </div>

        <button
          onClick={() => onOpenInventoryModal(null)}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มรายการวัสดุใหม่</span>
        </button>
      </div>

      {/* Inventory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const isLow = Number(item.qty) <= Number(item.minStock);
          return (
            <div
              key={item.id}
              className={`bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between gap-4 ${
                isLow ? 'border-amber-400 ring-1 ring-amber-200' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {item.sku} • {item.category}
                  </span>
                  {isLow ? (
                    <span className="text-xs font-extrabold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                      ⚠️ ใกล้หมด!
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-600">
                      ✓ ปกติ
                    </span>
                  )}
                </div>

                <h4 className="font-bold text-slate-900 text-sm mt-2.5">
                  {item.name}
                </h4>

                <div className="mt-3 flex items-baseline justify-between bg-slate-50 p-3 rounded-xl">
                  <div>
                    <span className="text-xs text-slate-400 block">
                      คงเหลือในสต็อก
                    </span>
                    <span
                      className={`text-2xl font-extrabold ${
                        isLow ? 'text-amber-600' : 'text-slate-900'
                      }`}
                    >
                      {item.qty}{' '}
                      <span className="text-sm font-semibold">{item.unit}</span>
                    </span>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    จุดสั่งซื้อขั้นต่ำ
                    <div className="font-bold text-slate-600">
                      {item.minStock} {item.unit}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => onOpenAdjustModal(item, 'out')}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold"
                >
                  - เบิกใช้หน้างาน
                </button>
                <button
                  onClick={() => onOpenAdjustModal(item, 'in')}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold"
                >
                  + รับเข้าสต็อก
                </button>
                <button
                  onClick={() => onOpenInventoryModal(item)}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// MODULE 8: JOB HISTORY & ISSUE TRACKING (ประวัติงาน & งานมีปัญหา)
// ============================================================================
function HistoryView({ jobs, onOpenIssueModal, onResolveIssue, onOpenJobModal }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'เสร็จสิ้น' | 'กำลังทำ' | 'มีปัญหา'

  const filtered = useMemo(() => {
    return jobs
      .filter((j) => (filter === 'all' ? true : j.status === filter))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [jobs, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: `งานทั้งหมด (${jobs.length})` },
          {
            id: 'เสร็จสิ้น',
            label: `✅ งานที่เสร็จแล้ว (${
              jobs.filter((j) => j.status === 'เสร็จสิ้น').length
            })`,
          },
          {
            id: 'กำลังทำ',
            label: `🔧 กำลังทำ (${
              jobs.filter((j) => j.status === 'กำลังทำ').length
            })`,
          },
          {
            id: 'มีปัญหา',
            label: `⚠️ งานที่มีปัญหา/รอแก้ไข (${
              jobs.filter((j) => j.status === 'มีปัญหา').length
            })`,
          },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition ${
              filter === t.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((job) => (
          <div
            key={job.id}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold bg-slate-100 px-2.5 py-1 rounded-lg">
                  {job.jobCode}
                </span>
                <span className="font-bold text-slate-900">
                  {job.customerName}
                </span>
                <StatusBadge status={job.status} />
                <span className="text-xs text-slate-400">
                  วันที่นัด: {formatThaiDate(job.date)}
                </span>
              </div>
              <p className="text-xs text-slate-600">{job.details}</p>
              <p className="text-xs text-slate-400">
                ช่างผู้รับผิดชอบ: {job.techName} • สถานที่: {job.location}
              </p>

              {job.issueNote && (
                <div className="mt-2 bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                  🚨 รายละเอียดปัญหา: {job.issueNote}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {job.status === 'มีปัญหา' ? (
                <button
                  onClick={() => onResolveIssue(job)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  ✓ แก้ไขเรียบร้อยแล้ว
                </button>
              ) : (
                <button
                  onClick={() => onOpenIssueModal(job)}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold"
                >
                  แจ้งปัญหา/เก็บงาน
                </button>
              )}
              <button
                onClick={() => onOpenJobModal(job)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                ดูข้อมูลงาน
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MODULE 9: WARRANTY TRACKER VIEW (รับประกันงาน)
// ============================================================================
function WarrantyView({ jobs, onSelectCustomer }) {
  const [search, setSearch] = useState('');

  const warrantyJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs
      .filter((j) => j.status === 'เสร็จสิ้น' || j.warrantyExpiry)
      .filter((j) => {
        if (!q) return true;
        return (
          (j.customerName || '').toLowerCase().includes(q) ||
          (j.customerPhone || '').includes(q) ||
          (j.jobCode || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        (b.completedDate || b.date || '').localeCompare(
          a.completedDate || a.date || ''
        )
      );
  }, [jobs, search]);

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">
            ทะเบียนรับประกันผลงานติดตั้ง
          </h3>
          <p className="text-xs text-slate-500">
            ระบบคำนวณวันหมดประกันอัตโนมัติเมื่อช่างกดปิดงานเสร็จสิ้น
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {warrantyJobs.length === 0 ? (
          <div className="col-span-full bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
            ยังไม่มีรายการงานที่เสร็จสิ้นในระบบรับประกัน
          </div>
        ) : (
          warrantyJobs.map((job) => {
            const installDate = job.completedDate || job.date;
            const expiry =
              job.warrantyExpiry ||
              addYearsToDate(installDate, job.warrantyYears || 1);
            const wStatus = getWarrantyStatus(expiry);

            const badgeColors = {
              emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              amber: 'bg-amber-50 text-amber-800 border-amber-200',
              rose: 'bg-rose-50 text-rose-700 border-rose-200',
              slate: 'bg-slate-100 text-slate-600 border-slate-200',
            };

            return (
              <div
                key={job.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button
                      onClick={() => onSelectCustomer(job.customerId)}
                      className="font-bold text-slate-900 hover:text-blue-600 text-base text-left"
                    >
                      {job.customerName}
                    </button>
                    <div className="text-xs text-slate-500 mt-0.5">
                      📞 {job.customerPhone} • {job.jobCode}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold border ${
                      badgeColors[wStatus.color]
                    }`}
                  >
                    🛡️ {wStatus.label}
                  </span>
                </div>

                <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl">
                  {job.details}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block">วันที่ติดตั้ง</span>
                    <span className="font-bold text-slate-800">
                      {formatThaiDate(installDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">ระยะประกัน</span>
                    <span className="font-bold text-blue-600">
                      {job.warrantyYears || 1} ปี
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">วันหมดประกัน</span>
                    <span className="font-extrabold text-slate-900">
                      {formatThaiDate(expiry)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MODULE 10: FINANCIAL & PROFIT REPORTS (รายงานกำไร รายรับ รายจ่าย)
// ============================================================================
function ReportsView({ incomes, expenses, jobs }) {
  const [selectedMonth, setSelectedMonth] = useState(
    getTodayISO().slice(0, 7)
  ); // YYYY-MM

  const reportData = useMemo(() => {
    const monthIncomes = incomes.filter((i) =>
      (i.date || '').startsWith(selectedMonth)
    );
    const monthExpenses = expenses.filter((e) =>
      (e.date || '').startsWith(selectedMonth)
    );
    const monthJobs = jobs.filter((j) =>
      (j.date || '').startsWith(selectedMonth)
    );

    const totalInc = monthIncomes.reduce(
      (s, i) => s + (Number(i.amount) || 0),
      0
    );
    const totalExp = monthExpenses.reduce(
      (s, e) => s + (Number(e.amount) || 0),
      0
    );
    const netProfit = totalInc - totalExp;
    const margin = totalInc > 0 ? Math.round((netProfit / totalInc) * 100) : 0;

    // Group expenses by category
    const expByCategory = {};
    monthExpenses.forEach((e) => {
      const cat = e.category || 'อื่นๆ';
      expByCategory[cat] = (expByCategory[cat] || 0) + (Number(e.amount) || 0);
    });

    // Daily breakdown for the selected month
    const dailyMap = {};
    monthIncomes.forEach((i) => {
      if (!dailyMap[i.date]) dailyMap[i.date] = { date: i.date, inc: 0, exp: 0 };
      dailyMap[i.date].inc += Number(i.amount) || 0;
    });
    monthExpenses.forEach((e) => {
      if (!dailyMap[e.date]) dailyMap[e.date] = { date: e.date, inc: 0, exp: 0 };
      dailyMap[e.date].exp += Number(e.amount) || 0;
    });
    const dailyList = Object.values(dailyMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const totalContractValue = monthJobs.reduce(
      (s, j) => s + (Number(j.totalAmount) || 0),
      0
    );

    return {
      totalInc,
      totalExp,
      netProfit,
      margin,
      expByCategory,
      dailyList,
      jobCount: monthJobs.length,
      totalContractValue,
    };
  }, [incomes, expenses, jobs, selectedMonth]);

  const maxDailyVal = Math.max(
    1000,
    ...reportData.dailyList.map((d) => Math.max(d.inc, d.exp))
  );

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">
            สรุปผลประกอบการร้านมุ้งลวด
          </h3>
          <p className="text-xs text-slate-500">
            เลือกเดือนที่ต้องการตรวจสอบรายรับ รายจ่าย และกำไรสุทธิ
          </p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-800"
        />
      </div>

      {/* 4 Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400">
            ยอดขายตามใบสั่งงาน ({reportData.jobCount} งาน)
          </div>
          <div className="text-2xl font-extrabold text-blue-600 mt-1.5">
            ฿{formatCurrency(reportData.totalContractValue)}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400">
            รายรับจริงเข้าบัญชี/เงินสด
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1.5">
            ฿{formatCurrency(reportData.totalInc)}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400">รายจ่ายรวม</div>
          <div className="text-2xl font-extrabold text-rose-600 mt-1.5">
            ฿{formatCurrency(reportData.totalExp)}
          </div>
        </div>
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md">
          <div className="text-xs font-bold text-slate-400">
            กำไรสุทธิ (อัตรากำไร {reportData.margin}%)
          </div>
          <div
            className={`text-2xl font-extrabold mt-1.5 ${
              reportData.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ฿{formatCurrency(reportData.netProfit)}
          </div>
        </div>
      </div>

      {/* Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Income vs Expense Bar Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-900 text-sm">
              เปรียบเทียบรายรับ - รายจ่าย รายวัน
            </h4>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                รายรับ
              </span>
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="w-3 h-3 rounded bg-rose-500 inline-block" />
                รายจ่าย
              </span>
            </div>
          </div>

          {reportData.dailyList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              ไม่มีความเคลื่อนไหวทางการเงินในเดือนที่เลือก
            </div>
          ) : (
            <div className="space-y-3">
              {reportData.dailyList.map((d) => (
                <div key={d.date} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700">
                      {formatThaiDate(d.date)}
                    </span>
                    <span>
                      <span className="text-emerald-600">
                        +฿{formatCurrency(d.inc)}
                      </span>{' '}
                      /{' '}
                      <span className="text-rose-600">
                        -฿{formatCurrency(d.exp)}
                      </span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (d.inc / maxDailyVal) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (d.exp / maxDailyVal) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expense Breakdown by Category */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-900 text-sm mb-4">
            สัดส่วนค่าใช้จ่ายแยกตามหมวดหมู่
          </h4>
          {Object.keys(reportData.expByCategory).length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              ยังไม่มีรายจ่ายในเดือนนี้
            </div>
          ) : (
            <div className="space-y-3.5">
              {Object.entries(reportData.expByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => {
                  const pct =
                    reportData.totalExp > 0
                      ? Math.round((amt / reportData.totalExp) * 100)
                      : 0;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700">{cat}</span>
                        <span className="text-rose-600">
                          ฿{formatCurrency(amt)} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODALS & DRAWER COMPONENTS
// ============================================================================

function ModalWrapper({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">{children}</div>
      </div>
    </div>
  );
}

// 1. JOB FORM MODAL
function JobFormModal({
  initialData,
  customers,
  technicians,
  todayISO,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    id: initialData?.id || '',
    jobCode: initialData?.jobCode || '',
    customerId: initialData?.customerId || '',
    customerName: initialData?.customerName || '',
    customerPhone: initialData?.customerPhone || '',
    location: initialData?.location || '',
    date: initialData?.date || todayISO,
    time: initialData?.time || '09:30',
    details: initialData?.details || '',
    totalAmount: initialData?.totalAmount ?? '',
    depositAmount: initialData?.depositAmount ?? '',
    paidAmount: initialData?.paidAmount ?? 0,
    paymentMethod: 'โอนเงิน',
    techId: initialData?.techId || (technicians[0]?.id || ''),
    helperCount: initialData?.helperCount ?? 1,
    status: initialData?.status || 'รอดำเนินการ',
    warrantyYears: initialData?.warrantyYears ?? 2,
    completedDate: initialData?.completedDate || '',
    issueNote: initialData?.issueNote || '',
  });

  const handleSelectExistingCustomer = (custId) => {
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setForm((prev) => ({
        ...prev,
        customerId: found.id,
        customerName: found.name,
        customerPhone: found.phone,
        location: found.address,
      }));
    } else {
      setForm((prev) => ({ ...prev, customerId: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.customerName || !form.details) return;
    onSave(form);
  };

  return (
    <ModalWrapper
      title={form.id ? `แก้ไขคิวงาน (${form.jobCode})` : '+ เพิ่มคิวงานติดตั้งใหม่'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pick Existing Customer */}
        {!form.id && customers.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              เลือกลูกค้าเดิม (หรือพิมพ์ลูกค้าใหม่ด้านล่าง)
            </label>
            <select
              value={form.customerId}
              onChange={(e) => handleSelectExistingCustomer(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-slate-50"
            >
              <option value="">-- ลูกค้าใหม่ --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ชื่อลูกค้า *
            </label>
            <input
              required
              type="text"
              placeholder="เช่น คุณสมศักดิ์ ใจดี"
              value={form.customerName}
              onChange={(e) =>
                setForm({ ...form, customerName: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              เบอร์โทรศัพท์ *
            </label>
            <input
              required
              type="tel"
              placeholder="08x-xxx-xxxx"
              value={form.customerPhone}
              onChange={(e) =>
                setForm({ ...form, customerPhone: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            สถานที่ติดตั้ง / หมู่บ้าน / เลขที่บ้าน *
          </label>
          <input
            required
            type="text"
            placeholder="ระบุที่อยู่หน้างาน..."
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              วันที่นัดติดตั้ง *
            </label>
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              เวลานัดหมาย
            </label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            รายละเอียดงาน (ประเภทมุ้ง, สีเฟรม, จำนวนบาน) *
          </label>
          <textarea
            required
            rows={2}
            placeholder="เช่น มุ้งจีบ 6 บาน + มุ้งบานเลื่อน 2 บาน เฟรมสีดำด้าน"
            value={form.details}
            onChange={(e) => setForm({ ...form, details: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        {/* Technician Assignment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
          <div>
            <label className="block text-xs font-bold text-blue-900 mb-1">
              👷 จ่ายงานให้ช่าง
            </label>
            <select
              value={form.techId}
              onChange={(e) => setForm({ ...form, techId: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-blue-200 text-sm bg-white"
            >
              <option value="">-- ยังไม่ระบุช่าง --</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-blue-900 mb-1">
              จำนวนผู้ช่วยช่าง (คน)
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={form.helperCount}
              onChange={(e) =>
                setForm({ ...form, helperCount: e.target.value })
              }
              className="w-full px-3 py-2.5 rounded-xl border border-blue-200 text-sm bg-white"
            />
          </div>
        </div>

        {/* Financials & Warranty */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ยอดรวม (บาท)
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={form.totalAmount}
              onChange={(e) =>
                setForm({ ...form, totalAmount: e.target.value })
              }
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {form.id ? 'ยอดมัดจำเริ่มต้น' : 'รับมัดจำ (บาท)'}
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={form.depositAmount}
              onChange={(e) =>
                setForm({ ...form, depositAmount: e.target.value })
              }
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              รับประกัน (ปี)
            </label>
            <select
              value={form.warrantyYears}
              onChange={(e) =>
                setForm({ ...form, warrantyYears: e.target.value })
              }
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value={1}>1 ปี</option>
              <option value={2}>2 ปี</option>
              <option value={3}>3 ปี</option>
              <option value={5}>5 ปี</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              สถานะงาน
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="รอดำเนินการ">รอดำเนินการ</option>
              <option value="กำลังทำ">กำลังทำ</option>
              <option value="เสร็จสิ้น">เสร็จสิ้น</option>
              <option value="มีปัญหา">มีปัญหา</option>
            </select>
          </div>
          {!form.id && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ช่องทางรับมัดจำ
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm({ ...form, paymentMethod: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="โอนเงิน">โอนเงิน</option>
                <option value="เงินสด">เงินสด</option>
              </select>
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow"
          >
            บันทึกคิวงาน
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// 2. CUSTOMER PROFILE DRAWER (FULL HISTORY + WARRANTY)
function CustomerProfileDrawer({
  customer,
  jobs,
  onClose,
  onEditCustomer,
  onAddJobForCustomer,
}) {
  const totalSpent = jobs.reduce(
    (s, j) => s + (Number(j.totalAmount) || 0),
    0
  );
  const totalPaid = jobs.reduce((s, j) => s + (Number(j.paidAmount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <span className="text-xs text-blue-400 font-bold">
              ข้อมูลลูกค้า & ประวัติการจ้างงาน
            </span>
            <h3 className="text-lg font-bold mt-0.5">{customer.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Contact Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                <Phone className="w-4 h-4" />
                <a href={`tel:${customer.phone}`}>{customer.phone}</a>
              </span>
              <button
                onClick={() => onEditCustomer(customer)}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                แก้ไขข้อมูลลูกค้า
              </button>
            </div>
            <p className="text-xs text-slate-600 flex items-start gap-1.5">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{customer.address}</span>
            </p>
            {customer.note && (
              <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded-lg">
                📝 หมายเหตุ: {customer.note}
              </p>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-blue-50 p-3 rounded-xl">
              <div className="text-[11px] text-blue-600 font-bold">จำนวนงาน</div>
              <div className="text-lg font-extrabold text-blue-900">
                {jobs.length} ครั้ง
              </div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl">
              <div className="text-[11px] text-emerald-600 font-bold">
                ยอดจ้างสะสม
              </div>
              <div className="text-lg font-extrabold text-emerald-900">
                ฿{formatCurrency(totalSpent)}
              </div>
            </div>
            <div className="bg-rose-50 p-3 rounded-xl">
              <div className="text-[11px] text-rose-600 font-bold">ค้างชำระ</div>
              <div className="text-lg font-extrabold text-rose-900">
                ฿{formatCurrency(totalSpent - totalPaid)}
              </div>
            </div>
          </div>

          {/* Job History List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm">
                ประวัติการติดตั้งทั้งหมด ({jobs.length})
              </h4>
              <button
                onClick={() => onAddJobForCustomer(customer)}
                className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg"
              >
                + เปิดงานใหม่ให้เจ้านี้
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                ยังไม่มีประวัติงานติดตั้ง
              </div>
            ) : (
              jobs.map((j) => {
                const wStatus = j.warrantyExpiry
                  ? getWarrantyStatus(j.warrantyExpiry)
                  : null;
                return (
                  <div
                    key={j.id}
                    className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        {j.jobCode} • {formatThaiDate(j.date)}
                      </span>
                      <StatusBadge status={j.status} />
                    </div>
                    <p className="text-slate-600">{j.details}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span>
                        ยอดรวม:{' '}
                        <strong>฿{formatCurrency(j.totalAmount)}</strong>
                      </span>
                      {wStatus && (
                        <span className="font-bold text-emerald-700">
                          🛡️ ประกันถึง {formatThaiDate(j.warrantyExpiry)} (
                          {wStatus.label})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. CUSTOMER FORM MODAL
function CustomerFormModal({ initialData, onClose, onSave }) {
  const [form, setForm] = useState({
    id: initialData?.id || '',
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    address: initialData?.address || '',
    note: initialData?.note || '',
    createdAt: initialData?.createdAt || '',
  });

  return (
    <ModalWrapper
      title={form.id ? 'แก้ไขข้อมูลลูกค้า' : '+ เพิ่มลูกค้าใหม่'}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ชื่อลูกค้า *
          </label>
          <input
            required
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            เบอร์โทร *
          </label>
          <input
            required
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ที่อยู่ / โครงการ / หมู่บ้าน *
          </label>
          <textarea
            required
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            หมายเหตุเพิ่มเติม
          </label>
          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold"
          >
            บันทึกข้อมูล
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// 4. TECHNICIAN FORM MODAL
function TechnicianFormModal({ initialData, onClose, onSave }) {
  const [form, setForm] = useState({
    id: initialData?.id || '',
    name: initialData?.name || '',
    role: initialData?.role || 'ช่างติดตั้ง',
    phone: initialData?.phone || '',
    status: initialData?.status || 'พร้อมปฏิบัติงาน',
  });

  return (
    <ModalWrapper
      title={form.id ? 'แก้ไขข้อมูลช่าง' : '+ เพิ่มพนักงาน / ช่างใหม่'}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ชื่อช่าง *
          </label>
          <input
            required
            type="text"
            placeholder="เช่น ช่างต้น"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ตำแหน่ง
          </label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="หัวหน้าช่างติดตั้ง">หัวหน้าช่างติดตั้ง</option>
            <option value="ช่างติดตั้ง">ช่างติดตั้ง</option>
            <option value="ช่างประกอบโรงงาน">ช่างประกอบโรงงาน</option>
            <option value="ผู้ช่วยช่าง">ผู้ช่วยช่าง</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            เบอร์โทรติดต่อ
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold"
          >
            บันทึก
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// 5. RECORD INCOME MODAL
function IncomeFormModal({
  linkedJob,
  defaultType,
  jobs,
  todayISO,
  onClose,
  onSave,
}) {
  const defaultBalance = linkedJob
    ? Math.max(
        0,
        (Number(linkedJob.totalAmount) || 0) -
          (Number(linkedJob.paidAmount) || 0)
      )
    : '';

  const [form, setForm] = useState({
    date: todayISO,
    jobId: linkedJob?.id || '',
    customerName: linkedJob?.customerName || '',
    type: defaultType || 'ชำระส่วนที่เหลือ',
    method: 'โอนเงิน',
    amount: defaultBalance,
    note: '',
  });

  const handleSelectJob = (jId) => {
    const j = jobs.find((x) => x.id === jId);
    if (j) {
      const rem = Math.max(
        0,
        (Number(j.totalAmount) || 0) - (Number(j.paidAmount) || 0)
      );
      setForm((prev) => ({
        ...prev,
        jobId: j.id,
        customerName: j.customerName,
        amount: rem > 0 ? rem : '',
      }));
    } else {
      setForm((prev) => ({ ...prev, jobId: '' }));
    }
  };

  return (
    <ModalWrapper title="+ บันทึกรายรับเข้าสู่ระบบ" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            อ้างอิงคิวงานลูกค้า
          </label>
          <select
            value={form.jobId}
            onChange={(e) => handleSelectJob(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="">-- รายรับทั่วไป / ไม่ระบุงาน --</option>
            {jobs.map((j) => {
              const rem =
                (Number(j.totalAmount) || 0) - (Number(j.paidAmount) || 0);
              return (
                <option key={j.id} value={j.id}>
                  {j.jobCode} - {j.customerName} (ค้าง ฿{formatCurrency(rem)})
                </option>
              );
            })}
          </select>
        </div>

        {!form.jobId && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ชื่อผู้ชำระ / ลูกค้า
            </label>
            <input
              required
              type="text"
              value={form.customerName}
              onChange={(e) =>
                setForm({ ...form, customerName: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              วันที่รับเงิน
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ประเภทการรับเงิน
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="มัดจำ">มัดจำ</option>
              <option value="ชำระส่วนที่เหลือ">ชำระส่วนที่เหลือ</option>
              <option value="ปิดงานเต็มจำนวน">ปิดงานเต็มจำนวน</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              จำนวนเงิน (บาท) *
            </label>
            <input
              required
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-400 text-base font-extrabold text-emerald-700"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ช่องทางชำระ
            </label>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="โอนเงิน">โอนเงิน</option>
              <option value="เงินสด">เงินสด</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            หมายเหตุ
          </label>
          <input
            type="text"
            placeholder="เช่น โอนเข้าบัญชีร้านเรียบร้อย"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
          >
            บันทึกรายรับ
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// 6. EXPENSE FORM MODAL
function ExpenseFormModal({ initialData, todayISO, onClose, onSave }) {
  const [form, setForm] = useState({
    id: initialData?.id || '',
    date: initialData?.date || todayISO,
    category: initialData?.category || 'ค่าวัสดุ/อลูมิเนียม/มุ้ง',
    description: initialData?.description || '',
    amount: initialData?.amount ?? '',
    staff: initialData?.staff || 'เจ้าของร้าน',
  });

  return (
    <ModalWrapper
      title={form.id ? 'แก้ไขรายการรายจ่าย' : '+ บันทึกรายจ่ายใหม่'}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              วันที่จ่าย
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              หมวดหมู่ค่าใช้จ่าย
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="ค่าวัสดุ/อลูมิเนียม/มุ้ง">
                ค่าวัสดุ/อลูมิเนียม/มุ้ง
              </option>
              <option value="ค่าแรงช่าง">ค่าแรงช่าง</option>
              <option value="ค่าน้ำมัน">ค่าน้ำมัน</option>
              <option value="ค่าเดินทาง/ทางด่วน">ค่าเดินทาง/ทางด่วน</option>
              <option value="ค่าใช้จ่ายอื่นๆ">ค่าใช้จ่ายอื่นๆ</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            รายละเอียดรายการจ่าย *
          </label>
          <input
            required
            type="text"
            placeholder="เช่น ซื้อเส้นอลูมิเนียมสีดำ, เติมน้ำมันรถกระบะ"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              จำนวนเงิน (บาท) *
            </label>
            <input
              required
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 text-base font-extrabold text-rose-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ผู้เบิก / ผู้จ่าย
            </label>
            <input
              type="text"
              value={form.staff}
              onChange={(e) => setForm({ ...form, staff: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold"
          >
            บันทึกรายจ่าย
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// 7. INVENTORY FORM MODAL
function InventoryFormModal({ initialData, onClose, onSave }) {
  const [form, setForm] = useState({
    id: initialData?.id || '',
    sku: initialData?.sku || '',
    name: initialData?.name || '',
    category: initialData?.category || 'อลูมิเนียม',
    qty: initialData?.qty ?? '',
    unit: initialData?.unit || 'เส้น',
    minStock: initialData?.minStock ?? 10,
  });

  return (
    <ModalWrapper
      title={form.id ? 'แก้ไขรายการวัสดุ' : '+ เพิ่มวัสดุในสต็อก'}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(form);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              รหัสสินค้า (SKU)
            </label>
            <input
              type="text"
              placeholder="เช่น ALU-BK-01"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              หมวดหมู่
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="อลูมิเนียม">อลูมิเนียม</option>
              <option value="มุ้งลวด">มุ้งลวด</option>
              <option value="อุปกรณ์/อะไหล่">อุปกรณ์/อะไหล่</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ชื่อวัสดุ / สี / ขนาด *
          </label>
          <input
            required
            type="text"
            placeholder="เช่น เฟรมอลูมิเนียมมุ้งจีบ สีดำด้าน (6 เมตร)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              จำนวนคงเหลือ *
            </label>
            <input
              required
              type="number"
              min="0"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              หน่วยนับ *
            </label>
            <input
              required
              type="text"
              placeholder="เส้น / ม้วน / ตัว"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              แจ้งเตือนเมื่อต่ำกว่า
            </label>
            <input
              type="number"
              min="0"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold"
          >
            บันทึกสต็อก
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// 8. STOCK IN/OUT MODAL
function StockAdjustModal({ item, mode, onClose, onConfirm }) {
  const [amount, setAmount] = useState(1);

  return (
    <ModalWrapper
      title={
        mode === 'in'
          ? `+ รับวัสดุเข้าสต็อก: ${item.name}`
          : `- เบิกใช้วัสดุหน้างาน: ${item.name}`
      }
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(item, mode, amount);
        }}
        className="space-y-4"
      >
        <div className="bg-slate-50 p-3.5 rounded-xl text-xs text-slate-600">
          จำนวนคงเหลือปัจจุบัน:{' '}
          <strong className="text-slate-900 text-sm">
            {item.qty} {item.unit}
          </strong>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ระบุจำนวนที่{mode === 'in' ? 'รับเข้า' : 'เบิกออก'} ({item.unit})
          </label>
          <input
            required
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-lg font-extrabold text-center"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className={`px-6 py-2.5 rounded-xl text-white text-sm font-bold ${
              mode === 'in' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            ยืนยัน{mode === 'in' ? 'รับเข้า' : 'เบิกใช้'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

// 9. ISSUE REPORT MODAL
function IssueReportModal({ job, onClose, onSave }) {
  const [note, setNote] = useState(job.issueNote || '');

  return (
    <ModalWrapper
      title={`⚠️ แจ้งปัญหางาน / นัดเก็บงาน (${job.jobCode})`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(job, note, false);
        }}
        className="space-y-4"
      >
        <div className="text-xs text-slate-600">
          ลูกค้า: <strong>{job.customerName}</strong> • สถานที่: {job.location}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ระบุรายละเอียดปัญหาหรือสิ่งที่ต้องแก้ไข *
          </label>
          <textarea
            required
            rows={3}
            placeholder="เช่น วัดขนาดหน้าต่างบานห้องนอนผิด ต้องตัดเฟรมใหม่ / รออะไหล่มือจับสีพิเศษ"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold"
          >
            บันทึกแจ้งปัญหา
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}