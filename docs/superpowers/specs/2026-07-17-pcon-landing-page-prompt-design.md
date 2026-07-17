# PCON Professional Landing Page Prompt Design

## Status

Approved by the user on 2026-07-17. This document defines the prompt and design decisions for a public PCON landing page before login. It does not authorize implementation by itself.

## Goal

Create a professional, modern 2026 landing page for PCON Project Control that feels premium but practical for Thai construction teams. The page must clearly explain the value of Project, BOQ, and Daily Report, establish trust without fabricated claims, and lead visitors to registration or login.

## Approved direction

- Visual direction: **Field Command Center**.
- Brand character: dependable, modern, field-ready, clear, and worth paying for.
- Heading font: **Mitr**, weights 500–600.
- Body and UI font: **Sarabun**, weights 400–700.
- Logo: reuse the current Mobile In-App `PconReferenceMark` from `app/project-setup/mobile-shell-ui.tsx` without redrawing or changing its SVG geometry, proportions, or colors.
- Logo colors: `#10B981`, `#047857`, `#34D399`, and `#FFFFFF`.
- Core palette: emerald `#064E3B`, `#047857`, `#059669`, `#10B981`; warm off-white `#F5F7F4`; white; slate text.
- The product UI is the primary hero visual. Do not let generic construction stock photography dominate the page.

## Research principles adapted for PCON

- Procore: lead with a concrete outcome, show the product early, and build a clear platform hierarchy.
- Autodesk Construction Cloud: frame the product as a single source of truth and connect field and office workflows.
- Buildertrend: speak directly to contractors and tie features to practical business outcomes.
- Fieldwire: emphasize field speed, mobile usability, and daily coordination.
- These are principles only. Do not clone their layouts, copy, illustrations, or visual identity.

## Approved page architecture

1. Sticky navigation and product-led hero.
2. Real site-management questions that reflect the user's daily problems.
3. Three core product modules: Project, BOQ and weighted progress, Daily Report.
4. Three-step workflow from project setup to daily reporting and management visibility.
5. Mobile-first and local-first benefits.
6. Primary audiences: contractors, site supervisors, renovation teams, and office staff.
7. Trust section based on real product behavior, not unsupported customer claims.
8. One strong final call to action and a restrained footer.

## Final reusable prompt

```text
คุณคือ World-class Product Designer, Web UI/UX Designer และ Senior Frontend Designer ที่เชี่ยวชาญ B2B SaaS, Construction Technology และเว็บไซต์ภาษาไทย ออกแบบ Landing Page สาธารณะก่อน Login สำหรับ “PCON Project Control” ให้ดูเป็นผลิตภัณฑ์ระดับสากลในปี 2026 แต่ยังใช้งานง่าย เป็นมิตร และเหมาะกับผู้รับเหมาไทย

เป้าหมายของหน้า
- ทำให้ผู้เข้าชมเข้าใจภายใน 5 วินาทีว่า PCON ช่วยควบคุมโครงการก่อสร้าง, BOQ, ความคืบหน้า และ Daily Report ในที่เดียว
- สื่อสารว่า PCON เชื่อมข้อมูลจากหน้างานกับออฟฟิศ ช่วยให้รู้ว่าแต่ละไซต์ทำอะไรไปแล้ว มีช่างกี่คน งานคืบหน้ากี่เปอร์เซ็นต์ และมีปัญหาอะไรต้องตาม
- สร้างความน่าเชื่อถือโดยใช้ความสามารถจริงของผลิตภัณฑ์ ห้ามสร้างจำนวนลูกค้า โลโก้ลูกค้า รีวิว รางวัล หรือสถิติที่ไม่มีหลักฐาน
- CTA หลักคือ “เริ่มใช้งานฟรี” ไปหน้า /register และ CTA สำหรับผู้ใช้เดิมคือ “เข้าสู่ระบบ” ไปหน้า /login

กลุ่มผู้ใช้หลัก
- ผู้รับเหมาและเจ้าของกิจการก่อสร้างขนาดเล็กถึงกลาง
- ทีมรับสร้างบ้านและทีมรีโนเวต
- ผู้ควบคุมไซต์และ Project Manager
- พนักงานออฟฟิศที่ต้องติดตามข้อมูลเดียวกับหน้างาน

ทิศทางงานภาพ: Field Command Center
- ภาพรวมต้องให้ความรู้สึก premium but practical, trustworthy, field-ready, modern และรวดเร็ว
- ใช้ Product UI เป็นภาพหลักใน Hero เช่น Dashboard preview ที่แสดงความคืบหน้า BOQ, จำนวนช่างวันนี้, เรื่องที่ต้องติดตาม และ Daily Report ล่าสุด
- ใช้พื้นหลัง warm off-white ร่วมกับ white cards, emerald surfaces, slate text, subtle architectural grid และ soft radial glow เฉพาะบริเวณที่ช่วยนำสายตา
- ใช้ card-based layout, border บาง, soft shadow, radius 16–24px และ spacing โปร่งแต่ไม่โล่งเกินไป
- หลีกเลี่ยงภาพลักษณ์ generic admin template, gradient จัด, glassmorphism มากเกินไป, neon, animation หนัก, icon 3D ที่ไม่เกี่ยวข้อง และ stock photo คนงานขนาดใหญ่ที่กลบตัวผลิตภัณฑ์

Brand และ Logo
- ยึดโลโก้ Mobile In-App เวอร์ชันปัจจุบันจาก component `PconReferenceMark` ใน `app/project-setup/mobile-shell-ui.tsx`
- Reuse SVG เดิมโดยตรง ห้ามวาดใหม่ ห้ามเปลี่ยน geometry, proportions หรือสี
- สีโลโก้ต้องคงเป็น #10B981, #047857, #34D399 และ #FFFFFF
- แสดง wordmark “PCON” และ descriptor “PROJECT CONTROL” อย่างเรียบง่าย ห้ามสร้างสัญลักษณ์ PC แบบใหม่

Typography
- ใช้ Mitr น้ำหนัก 500–600 สำหรับ H1, H2 และหัวข้อสำคัญ ให้หัวข้อดูแข็งแรง โมเดิร์น และมีเอกลักษณ์
- ใช้ Sarabun น้ำหนัก 400–700 สำหรับ body text, navigation, buttons, labels, forms และข้อมูล Dashboard เพื่อความอ่านง่ายในภาษาไทย
- ไม่ใช้ Itim เพราะให้บุคลิกขี้เล่นเกินไปสำหรับ B2B Construction
- ไม่ใช้ Chakra Petch เป็นฟอนต์หลัก เพราะให้ความรู้สึก tech/futuristic มากกว่าความน่าเชื่อถือแบบงานก่อสร้างจริง
- รักษา line-height ภาษาไทยให้อ่านสบาย และไม่ใช้ตัวอักษรเล็กกว่า 16px สำหรับเนื้อหาหลักบนมือถือ

Color system
- Primary dark emerald: #064E3B
- Primary emerald: #047857 และ #059669
- Accent emerald: #10B981
- Soft green surfaces: #ECFDF5 และ #D1FAE5
- Warm page background: #F5F7F4
- Main text: #0F172A
- Secondary text: #475569 หรือ #64748B
- ใช้ amber/red เฉพาะสถานะที่ต้องให้ความสนใจ ห้ามใช้สีเป็นตัวสื่อความหมายเพียงอย่างเดียว

โครงสร้างหน้าและเนื้อหา

1. Sticky Navigation
- ซ้าย: โลโก้ PconReferenceMark + PCON / PROJECT CONTROL
- เมนู: ภาพรวม, ฟีเจอร์, เหมาะกับใคร, วิธีใช้งาน
- ขวา: “เข้าสู่ระบบ” และปุ่ม Primary “เริ่มใช้งานฟรี”
- Mobile ใช้ header กระชับและเมนูที่เปิดใช้งานได้จริง ปุ่มต้องมีพื้นที่แตะอย่างน้อย 44px

2. Hero Section
- Kicker: “สร้างเพื่อทีมก่อสร้างไทย”
- H1 ใช้ Mitr: “รู้ทุกไซต์ คุมทุกงาน จบในที่เดียว” โดยเน้นคำว่า “คุมทุกงาน” ด้วยสี emerald
- Supporting copy: “PCON รวม Project, BOQ และ Daily Report ไว้ในระบบเดียว ให้ทีมหน้างานและออฟฟิศเห็นข้อมูลตรงกัน ตัดสินใจเร็วขึ้นทุกวัน”
- Primary CTA: “เริ่มใช้งานฟรี” → /register
- Secondary CTA: “ดูระบบทำงาน” → เลื่อนไป Section ฟีเจอร์หรือ Workflow ด้วย anchor ที่มีปลายทางจริง
- Product visual ด้านขวาบน Desktop และอยู่ใต้ CTA บน Mobile แสดงตัวอย่าง Dashboard ภาษาไทย เช่น โครงการบ้านสุขุมวิท, ความคืบหน้า BOQ 68%, ช่างวันนี้ 24 คน, เรื่องต้องตาม 3 เรื่อง และสรุป Daily Report
- ข้อมูลตัวอย่างเป็น product preview เท่านั้น ห้ามนำไปใช้เป็น social proof หรืออ้างว่าเป็นข้อมูลลูกค้าจริง

3. Daily Questions / Problem Framing
- พื้นหลัง dark emerald เพื่อสร้างจังหวะภาพ
- หัวข้อ: “ทุกเช้า คุณควรรู้ว่าไซต์กำลังเป็นอย่างไร”
- แสดงคำถามจริงแบบ card สั้น ๆ: “วันนี้ทำอะไรไปแล้ว?”, “ช่างเข้าไซต์กี่คน?”, “งานคืบหน้ากี่เปอร์เซ็นต์?”, “BOQ รวมเท่าไหร่?”, “มีปัญหาอะไรต้องตาม?”, “พรุ่งนี้ต้องทำอะไรต่อ?”
- แต่ละ card ต้องเชื่อมคำถามกับผลลัพธ์ที่ PCON ช่วยให้เห็น ไม่ใช่เพียงรายการฟีเจอร์

4. Core Modules
- หัวข้อ: “เครื่องมือหลักที่ทีมก่อสร้างใช้ทุกวัน”
- แสดง 3 cards พร้อม product UI preview ที่สมจริง:
  1) Project — สถานะโครงการ ลูกค้า ทีม งบประมาณ และภาพรวม
  2) BOQ & Weighted Progress — ยอดรวมหมวดงาน รายการ ปริมาณ ราคาต่อหน่วย และความคืบหน้าแบบถ่วงน้ำหนักตามมูลค่างาน
  3) Daily Report — งานเสร็จ งานต่อเนื่อง ปัญหา วัสดุ คนงาน แผนพรุ่งนี้ และประวัติรายงาน
- ย้ำว่า BOQ progress ไม่ใช่ค่าเฉลี่ยธรรมดา แต่คำนวณตามมูลค่างาน

5. Three-step Workflow
- หัวข้อ: “จากหน้างานถึงภาพรวมผู้บริหารใน 3 ขั้นตอน”
- Step 1: สร้างโครงการและใส่ BOQ
- Step 2: ทีมไซต์บันทึก Daily Report บนมือถือ
- Step 3: ผู้ดูแลเห็นความคืบหน้า คนงาน และปัญหาที่ต้องตาม
- ใช้ flow ที่สั้น ชัด และเข้าใจได้โดยไม่ต้องอ่านคู่มือ

6. Mobile-first / Local-first
- หัวข้อ: “สร้างมาเพื่อหน้างาน ไม่ใช่แค่โต๊ะทำงาน”
- แสดง mobile device mockup ของ Daily Report หรือ Dashboard
- ประโยชน์ที่สื่อสารได้: ปุ่มใหญ่และกรอกง่ายบนมือถือ, ข้อมูลคงอยู่หลัง Refresh, Import/Export JSON เพื่อสำรองหรือย้ายข้อมูล
- ใช้คำที่ลูกค้าเข้าใจ หลีกเลี่ยงศัพท์เทคนิคอย่าง localStorage ในข้อความการตลาดหลัก

7. Audience
- หัวข้อ: “เหมาะกับทีมที่ต้องคุมงานจริงทุกวัน”
- Cards สำหรับ ผู้รับเหมา, ผู้ควบคุมไซต์, ทีมรีโนเวต/รับสร้างบ้าน และทีมออฟฟิศ
- อธิบาย outcome เฉพาะกลุ่มอย่างกระชับ ไม่สร้าง persona หรือคำรับรองปลอม

8. Trust Section
- หัวข้อ: “เรียบง่าย แต่เชื่อถือได้”
- ใช้หลักฐานจาก behavior จริงของระบบ: ข้อมูลคงอยู่หลัง Refresh, BOQ คำนวณความคืบหน้าแบบถ่วงน้ำหนัก, Daily Report มี create/edit/delete/history, Import/Export ใช้งานได้ และออกแบบ mobile-first
- ห้ามใช้โลโก้ลูกค้า จำนวนโครงการ คะแนนรีวิว หรือ certification หากไม่มีข้อมูลจริงรองรับ

9. Final CTA
- พื้นหลัง dark emerald แบบเรียบหรู
- หัวข้อ: “พร้อมเห็นทุกไซต์ให้ชัดขึ้นหรือยัง?”
- ข้อความ: “เริ่มจัดการ Project, BOQ และ Daily Report ในที่เดียว”
- ปุ่ม “เริ่มใช้งาน PCON” → /register
- มีลิงก์ “เข้าสู่ระบบ” → /login สำหรับผู้ใช้เดิม

10. Footer
- โลโก้และชื่อ PCON Project Control
- ลิงก์เฉพาะหน้าที่มีจริง เช่น ผลิตภัณฑ์, ความเป็นส่วนตัว, เข้าสู่ระบบ
- ไม่มีลิงก์ปลอม, href="#", empty onClick หรือเมนูที่ยังไม่มีปลายทาง

Responsive และ Accessibility
- ออกแบบ mobile-first และตรวจที่ 360x800, 390x844, 768px และ 1440px
- ไม่มี page-level horizontal overflow
- ปุ่มและ interactive targets อย่างน้อย 44x44px
- ใช้ semantic HTML, heading hierarchy ที่ถูกต้อง, visible focus state และ contrast ที่อ่านง่าย
- รองรับ keyboard และ prefers-reduced-motion
- บนมือถือ Hero ต้องสั้น กระชับ CTA เห็นก่อน และ product preview อ่านออกโดยไม่ย่อ Desktop dashboard ลงมาตรง ๆ

Interaction และ Motion
- ใช้ micro-interaction 150–220ms เฉพาะ hover, focus, card elevation และ navigation state
- ไม่ใช้ parallax หนัก, scroll-jacking, autoplay video หรือ animation ที่ทำให้การโหลดช้า
- Sticky navigation ต้องไม่บังเนื้อหาเมื่อเลื่อนไป anchor sections

ข้อกำหนดทางเทคนิคเมื่อสร้างโค้ด
- ใช้ Next.js App Router, React, TypeScript และ Tailwind CSS ตามโครงสร้างเดิม
- ใช้ next/font/google สำหรับ Mitr และ Sarabun เพื่อควบคุม performance และลด layout shift
- ห้ามติดตั้ง package เพิ่มโดยไม่จำเป็น และใช้ shadcn/ui เฉพาะเมื่อมีอยู่แล้ว
- Landing Page อยู่ที่ route `/` และต้องไม่ทำลาย `/login`, `/register`, `/project-setup`, Project, BOQ, Daily Report, local persistence หรือ Import/Export
- แยก section เป็น component ที่อ่านง่าย ไม่รวมทุกอย่างไว้ในไฟล์เดียวขนาดใหญ่
- Reuse logo component เดิมหรือย้ายไป shared component อย่างปลอดภัยโดยไม่เปลี่ยนรูปทรง
- ใช้ภาพหน้าจอจริงของ PCON หากมีและเหมาะสม; หากยังไม่มี ให้สร้าง product UI mockup ด้วย HTML/CSS ที่ระบุชัดว่าเป็นภาพสาธิต
- ปุ่มทุกปุ่มต้องทำงานจริง ไม่มี fake button, empty handler หรือ dead link
- อัปเดต metadata ภาษาไทยสำหรับ title, description และ social preview โดยไม่อ้างสถิติที่ไม่มีหลักฐาน

เกณฑ์ตรวจรับ
- ภายใน first viewport ผู้ใช้เห็น logo, value proposition, CTA และ product preview ครบ
- หน้าเว็บดูเป็น Construction SaaS ระดับพรีเมียม ไม่ใช่ admin template หรือเว็บไซต์รับเหมาก่อสร้างทั่วไป
- ตัวอักษรไทยอ่านง่ายและใช้ Mitr/Sarabun ตามบทบาทที่กำหนด
- โลโก้ตรงกับ Mobile In-App ล่าสุดทุกประการ
- แสดง Project, BOQ และ Daily Report เป็นหัวใจของผลิตภัณฑ์
- ไม่มีคำโฆษณาเกินจริง ฟีเจอร์อนาคต ลิงก์ปลอม หรือสถิติปลอม
- Mobile 360px ใช้งานได้จริง ปุ่มไม่เล็กและไม่มี horizontal overflow
- เมื่อทำโค้ดเสร็จ ให้รัน npm run lint, npm run typecheck และ npm run build พร้อมรายงานผล
```

## Self-review

- The specification contains no unfinished requirement, fabricated customer proof, or unsupported feature.
- Typography, logo source, colors, routes, copy, responsive targets, and CTA destinations are explicit.
- The scope is limited to a public landing page and does not alter core project-control behavior.
- The prompt distinguishes real product behavior from illustrative product-preview data.

## Implementation boundary

The next step, only if requested by the user, is to create an implementation plan for the landing page. No production code is changed by this design document.
