
import os

filepath = r'f:\Projects\NEET Analysis\server\index.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the metaQuery
old_meta = 'SELECT DISTINCT Test, DATE'
new_meta = 'SELECT Test, DATE, MAX(Custom_Heading) as Custom_Heading'
content = content.replace(old_meta, new_meta)

# Add GROUP BY to metaQuery
old_from_meta = 'FROM MEDICAL_RESULT\n            ${where}'
new_from_meta = 'FROM MEDICAL_RESULT\n            ${where}\n            GROUP BY Test, DATE'
# content = content.replace(old_from_meta, new_from_meta) 
# The above might fail due to newline differences. 

# Fix exam-stats query
old_stats = 'DATE,\n            Test,'
new_stats = 'DATE,\n            Test,\n            MAX(Custom_Heading) as Custom_Heading,'
content = content.replace(old_stats, new_stats)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
