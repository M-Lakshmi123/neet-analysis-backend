import os, glob, time
import openpyxl
import cv2
import numpy as np
from PIL import Image

start_time = time.time()
print("=== Student Photo Auto-Crop and Rename (OMR ID) Pipeline ===")

excel_path = r'E:\2026\Acadamic 2026-2027\Academic Student Photos\DS Student List.xlsx'
raw_dir = r'E:\2026\Acadamic 2026-2027\Academic Student Photos\Re Name\Re Name'
output_dir = r'E:\2026\Acadamic 2026-2027\Academic Student Photos\Cropped_OMR_Photos'

os.makedirs(output_dir, exist_ok=True)
print(f"Output directory: {output_dir}")

# 1. Parse Excel mapping
wb = openpyxl.load_workbook(excel_path, data_only=True)
mapping = {} # key: clean SCS -> { omr_id, omr_7digit, student_name, class_name }

if 'ALL' in wb.sheetnames:
    s = wb['ALL']
    for r in range(3, s.max_row + 1):
        adm = s.cell(r, 2).value
        omr = s.cell(r, 3).value
        if adm and omr:
            adm_clean = str(adm).strip().upper()
            omr_clean = str(int(omr)) if isinstance(omr, (int, float)) else str(omr).strip()
            mapping[adm_clean] = {
                'omr_id': omr_clean,
                'omr_7digit': omr_clean[-7:] if len(omr_clean) >= 7 else omr_clean,
                'student_name': '',
                'class_name': ''
            }

if 'SR & JR' in wb.sheetnames:
    s = wb['SR & JR']
    for r in range(2, s.max_row + 1):
        adm = s.cell(r, 2).value
        omr = s.cell(r, 3).value
        omr7 = s.cell(r, 4).value
        name = s.cell(r, 5).value
        cls = s.cell(r, 7).value
        if adm:
            adm_clean = str(adm).strip().upper()
            omr_clean = str(int(omr)) if isinstance(omr, (int, float)) else str(omr or '').strip()
            omr7_clean = str(int(omr7)) if isinstance(omr7, (int, float)) else str(omr7 or '').strip()
            name_clean = str(name or '').strip()
            cls_clean = str(cls or '').strip()
            
            if adm_clean in mapping:
                if name_clean: mapping[adm_clean]['student_name'] = name_clean
                if cls_clean: mapping[adm_clean]['class_name'] = cls_clean
                if omr7_clean: mapping[adm_clean]['omr_7digit'] = omr7_clean
                if omr_clean and not mapping[adm_clean]['omr_id']: mapping[adm_clean]['omr_id'] = omr_clean
            else:
                mapping[adm_clean] = {
                    'omr_id': omr_clean,
                    'omr_7digit': omr7_clean or (omr_clean[-7:] if len(omr_clean) >= 7 else omr_clean),
                    'student_name': name_clean,
                    'class_name': cls_clean
                }

# Known manual corrections
mapping['SCS726069'] = {'omr_id': '257405308', 'omr_7digit': '7405308', 'student_name': 'ABOORVA', 'class_name': ''}
mapping['SCS990410'] = {'omr_id': '268419469', 'omr_7digit': '8419469', 'student_name': 'SACHIT RAVI', 'class_name': ''}
mapping['SCS387772'] = {'omr_id': '257387772', 'omr_7digit': '7387772', 'student_name': 'NIDA BUSHRA SAYED', 'class_name': ''}

print(f"Total students mapped in registry: {len(mapping)}")

# 2. Setup OpenCV Face Detection
cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
face_cascade = cv2.CascadeClassifier(cascade_path)

# Profile face cascade fallback if needed
profile_cascade_path = cv2.data.haarcascades + 'haarcascade_profileface.xml'
profile_cascade = cv2.CascadeClassifier(profile_cascade_path)

def crop_student_photo(im):
    # Target aspect ratio matching user's reference image (905 x 1024 = 0.883789)
    target_ratio = 905.0 / 1024.0
    
    # Downscale for fast face detection
    scale = 0.25
    w_small = int(im.size[0] * scale)
    h_small = int(im.size[1] * scale)
    im_small = im.resize((w_small, h_small))
    
    gray = cv2.cvtColor(np.array(im_small), cv2.COLOR_RGB2GRAY)
    
    # Detect frontal faces
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
    if len(faces) == 0:
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(60, 60))
        
    if len(faces) == 0 and os.path.exists(profile_cascade_path):
        faces = profile_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(70, 70))
        
    if len(faces) > 0:
        # Pick largest face
        faces = sorted(faces, key=lambda fc: fc[2]*fc[3], reverse=True)
        fx, fy, fw, fh = faces[0]
        orig_fx = int(fx / scale)
        orig_fy = int(fy / scale)
        orig_fw = int(fw / scale)
        orig_fh = int(fh / scale)
        
        center_x = orig_fx + orig_fw // 2
        crop_h = int(orig_fh * 3.1)
        crop_w = int(crop_h * target_ratio)
        
        headroom = int(orig_fh * 0.55)
        crop_y1 = max(0, orig_fy - headroom)
        crop_y2 = crop_y1 + crop_h
        if crop_y2 > im.size[1]:
            crop_y2 = im.size[1]
            crop_y1 = max(0, crop_y2 - crop_h)
            
        crop_x1 = max(0, center_x - crop_w // 2)
        crop_x2 = crop_x1 + crop_w
        if crop_x2 > im.size[0]:
            crop_x2 = im.size[0]
            crop_x1 = max(0, crop_x2 - crop_w)
    else:
        # Fixed studio tripod framing fallback
        crop_h = int(im.size[1] * 0.70)
        crop_w = int(crop_h * target_ratio)
        crop_y1 = int(im.size[1] * 0.15)
        crop_y2 = crop_y1 + crop_h
        crop_x1 = (im.size[0] - crop_w) // 2
        crop_x2 = crop_x1 + crop_w
        
    cropped = im.crop((crop_x1, crop_y1, crop_x2, crop_y2))
    # Resize to standard high-res 905 x 1024
    return cropped.resize((905, 1024), Image.Resampling.LANCZOS)

# 3. Process all raw photos
raw_files = sorted(glob.glob(os.path.join(raw_dir, '*.*')))
print(f"Found {len(raw_files)} photos in {raw_dir}")

results = []
count = 0
unmatched_count = 0

for f in raw_files:
    count += 1
    filename = os.path.basename(f)
    base = os.path.splitext(filename)[0].strip().upper()
    
    # Match with Excel
    info = mapping.get(base)
    if not info:
        # Try without SCS prefix or fuzzy
        for k, v in mapping.items():
            if k.replace('SCS', '') == base.replace('SCS', ''):
                info = v
                break
                
    if info and info['omr_id']:
        target_name = f"{info['omr_id']}.jpg"
        is_matched = True
        student_name = info['student_name']
        omr_id = info['omr_id']
    else:
        # Fallback to SCS base name if no OMR ID found in Excel
        target_name = f"{base}.jpg"
        is_matched = False
        student_name = ""
        omr_id = base
        unmatched_count += 1
        
    out_file = os.path.join(output_dir, target_name)
    
    try:
        im = Image.open(f)
        # If already cropped (like the user reference photo SCS990960 which is 2558x2893), just resize to 905x1024
        if im.size == (2558, 2893) or (im.size[0] < 3000 and im.size[1] < 3000):
            cropped = im.resize((905, 1024), Image.Resampling.LANCZOS)
        else:
            cropped = crop_student_photo(im)
            
        cropped.save(out_file, 'JPEG', quality=92, optimize=True)
        size_kb = round(os.path.getsize(out_file) / 1024.0, 1)
        
        results.append({
            'original_file': filename,
            'scs_number': base,
            'omr_id': omr_id,
            'output_file': target_name,
            'student_name': student_name,
            'matched': is_matched,
            'size_kb': size_kb
        })
        
        if count % 50 == 0 or count == len(raw_files):
            print(f"Processed {count}/{len(raw_files)} photos... ({round(time.time() - start_time, 1)}s)")
    except Exception as e:
        print(f"Error processing {filename}: {e}")

elapsed = round(time.time() - start_time, 1)
print(f"\n================ SUMMARY ================")
print(f"Total processed: {count} photos")
print(f"Matched with OMR ID: {count - unmatched_count}")
print(f"Saved under SCS (unmatched in Excel): {unmatched_count}")
print(f"Output directory: {output_dir}")
print(f"Total time: {elapsed} seconds")
print(f"=========================================\n")

# Save detailed JSON summary
import json
json_path = os.path.join(output_dir, 'crop_summary.json')
with open(json_path, 'w', encoding='utf-8') as jf:
    json.dump(results, jf, indent=2)
print(f"Summary report saved to: {json_path}")
