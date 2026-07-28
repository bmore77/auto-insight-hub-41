CREATE POLICY "Anyone can read tableau screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'tableau-screenshots');
CREATE POLICY "Anyone can upload tableau screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tableau-screenshots');
CREATE POLICY "Anyone can update tableau screenshots" ON storage.objects FOR UPDATE USING (bucket_id = 'tableau-screenshots') WITH CHECK (bucket_id = 'tableau-screenshots');
CREATE POLICY "Anyone can delete tableau screenshots" ON storage.objects FOR DELETE USING (bucket_id = 'tableau-screenshots');