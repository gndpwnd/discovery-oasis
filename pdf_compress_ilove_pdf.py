# pdf compression script to interface with ilovepdf.com using selenium

import os
import sys
import time
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# --- CONFIG ---
BASE_URL = "https://www.ilovepdf.com/compress_pdf"
OUTPUT_DIR = "./compressed_pdfs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def setup_chrome_driver(download_dir):
    """Setup Chrome driver with download preferences"""
    chrome_options = Options()
    
    # Set download directory
    prefs = {
        "download.default_directory": download_dir,
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True,
        "plugins.always_open_pdf_externally": True  # Bypass PDF viewer
    }
    chrome_options.add_experimental_option("prefs", prefs)
    
    # Optional: Run headless (uncomment if desired)
    # chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options
    )
    driver.set_window_size(1280, 800)
    
    return driver

def wait_for_download(download_dir, timeout=180):
    """Wait for download to complete"""
    print(f"[WAIT] Waiting for download to complete...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        # Check for .crdownload files (Chrome incomplete downloads)
        files = os.listdir(download_dir)
        crdownload_files = [f for f in files if f.endswith('.crdownload')]
        
        if crdownload_files:
            # Download in progress
            time.sleep(2)
            continue
        
        # Check for newly downloaded PDF files
        pdf_files = [f for f in files if f.endswith('.pdf')]
        if pdf_files:
            # Find the most recently modified file
            pdf_paths = [os.path.join(download_dir, f) for f in pdf_files]
            latest_file = max(pdf_paths, key=os.path.getmtime)
            
            # Check if file was modified recently (within last 10 seconds)
            if time.time() - os.path.getmtime(latest_file) < 10:
                print(f"[SUCCESS] Download complete: {os.path.basename(latest_file)}")
                return latest_file
        
        time.sleep(1)
    
    print("[ERROR] Download timeout")
    return None

def compress_pdf(driver, pdf_path, compression_level="extreme"):
    """
    Compress a single PDF file
    
    Args:
        driver: Selenium WebDriver instance
        pdf_path: Path to the PDF file to compress
        compression_level: "extreme", "recommended", or "low"
    """
    if not os.path.exists(pdf_path):
        print(f"[ERROR] File not found: {pdf_path}")
        return None
    
    pdf_name = os.path.basename(pdf_path)
    print(f"\n{'='*80}")
    print(f"[COMPRESS] Processing: {pdf_name}")
    print(f"[COMPRESS] Compression level: {compression_level}")
    print(f"{'='*80}\n")
    
    # Navigate to the upload page
    print(f"[STEP 1] Navigating to {BASE_URL}")
    driver.get(BASE_URL)
    time.sleep(3)
    
    # Find the hidden file input and send the file path
    print("[STEP 2] Uploading PDF file...")
    try:
        # The hidden input element that accepts files
        file_input = driver.find_element(By.CSS_SELECTOR, "input[type='file'][accept='.pdf']")
        
        # Send the absolute path to the file input
        abs_path = os.path.abspath(pdf_path)
        file_input.send_keys(abs_path)
        print(f"[OK] File uploaded: {pdf_name}")
        
        # Wait for upload to complete
        time.sleep(5)
        
    except Exception as e:
        print(f"[ERROR] Failed to upload file: {e}")
        return None
    
    # Click settings button to reveal compression options
    print("[STEP 3] Opening compression settings...")
    try:
        settings_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, "settingsToogle"))
        )
        settings_btn.click()
        time.sleep(2)
        print("[OK] Settings panel opened")
    except Exception as e:
        print(f"[WARN] Could not open settings (may already be visible): {e}")
    
    # Select compression level
    print(f"[STEP 4] Selecting compression level: {compression_level}")
    try:
        compression_option = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((
                By.CSS_SELECTOR, 
                f"li.option__select__item[data-value='{compression_level}']"
            ))
        )
        compression_option.click()
        time.sleep(1)
        
        # Verify selection
        if "option--active" in compression_option.get_attribute("class"):
            print(f"[OK] Compression level set to: {compression_level}")
        else:
            print(f"[WARN] Compression level may not be selected properly")
            
    except Exception as e:
        print(f"[ERROR] Failed to select compression level: {e}")
        return None
    
    # Click the "Compress PDF" button
    print("[STEP 5] Starting compression...")
    try:
        compress_btn = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.ID, "processTask"))
        )
        compress_btn.click()
        print("[OK] Compression started")
        
    except Exception as e:
        print(f"[ERROR] Failed to click compress button: {e}")
        return None
    
    # Wait for compression to complete and download button to appear
    print("[STEP 6] Waiting for compression to complete (this may take 1-2 minutes)...")
    try:
        # Wait up to 180 seconds for the download link
        download_link = WebDriverWait(driver, 180).until(
            EC.presence_of_element_located((
                By.CSS_SELECTOR, 
                "a.downloader__btn[href*='download']"
            ))
        )
        
        print("[OK] Compression complete!")
        
        # Get the download URL
        download_url = download_link.get_attribute("href")
        print(f"[INFO] Download URL: {download_url[:80]}...")
        
        # Click the download button
        print("[STEP 7] Downloading compressed PDF...")
        download_link.click()
        time.sleep(2)
        
        # Check if we're redirected to chrome extension PDF viewer
        current_url = driver.current_url
        if current_url.startswith("chrome-extension://"):
            print("[INFO] PDF opened in Chrome extension viewer, attempting to download...")
            try:
                # Try to find and click the save/download button in the PDF viewer
                download_btn = WebDriverWait(driver, 10).until(
                    EC.element_to_be_clickable((By.ID, "download"))
                )
                download_btn.click()
                print("[OK] Clicked download button in PDF viewer")
                time.sleep(2)
            except Exception as e:
                print(f"[WARN] Could not click download in PDF viewer: {e}")
                print("[INFO] Attempting direct download via URL...")
                # Extract actual download URL from the extension URL
                if "https://" in current_url:
                    actual_url = current_url.split("https://", 1)[1]
                    actual_url = "https://" + actual_url
                    driver.get(actual_url)
                    time.sleep(3)
        
        # Wait for download to complete
        downloaded_file = wait_for_download(OUTPUT_DIR, timeout=180)
        
        if downloaded_file:
            print(f"[SUCCESS] Compressed PDF saved: {downloaded_file}")
            
            # Print file size comparison
            original_size = os.path.getsize(pdf_path)
            compressed_size = os.path.getsize(downloaded_file)
            reduction = ((original_size - compressed_size) / original_size) * 100
            
            print(f"\n[STATS] Original size: {original_size / 1024 / 1024:.2f} MB")
            print(f"[STATS] Compressed size: {compressed_size / 1024 / 1024:.2f} MB")
            print(f"[STATS] Size reduction: {reduction:.1f}%\n")
            
            return downloaded_file
        else:
            print("[ERROR] Download failed or timed out")
            return None
            
    except Exception as e:
        print(f"[ERROR] Compression/download failed: {e}")
        return None

def main():
    """Main function to process PDFs from command line or directory"""
    
    # Parse command line arguments
    if len(sys.argv) < 2:
        print("[ERROR] No PDF file specified")
        print(f"[USAGE] python {sys.argv[0]} <pdf_file.pdf> [compression_level]")
        print(f"[USAGE] python {sys.argv[0]} <directory_with_pdfs> [compression_level]")
        print("\nCompression levels: extreme, recommended, low (default: extreme)")
        sys.exit(1)
    
    input_path = sys.argv[1]
    compression_level = sys.argv[2] if len(sys.argv) > 2 else "extreme"
    
    # Validate compression level
    if compression_level not in ["extreme", "recommended", "low"]:
        print(f"[ERROR] Invalid compression level: {compression_level}")
        print("Valid options: extreme, recommended, low")
        sys.exit(1)
    
    # Collect PDF files to process
    pdf_files = []
    if os.path.isfile(input_path):
        if input_path.lower().endswith('.pdf'):
            pdf_files = [input_path]
        else:
            print("[ERROR] Input file is not a PDF")
            sys.exit(1)
    elif os.path.isdir(input_path):
        pdf_files = [
            os.path.join(input_path, f) 
            for f in os.listdir(input_path) 
            if f.lower().endswith('.pdf')
        ]
        if not pdf_files:
            print(f"[ERROR] No PDF files found in directory: {input_path}")
            sys.exit(1)
    else:
        print(f"[ERROR] Path not found: {input_path}")
        sys.exit(1)
    
    print(f"[INFO] Found {len(pdf_files)} PDF file(s) to process")
    print(f"[INFO] Output directory: {os.path.abspath(OUTPUT_DIR)}")
    
    # Setup Chrome driver
    print("[INFO] Starting Chrome browser...")
    driver = setup_chrome_driver(os.path.abspath(OUTPUT_DIR))
    
    try:
        # Process each PDF
        results = []
        for idx, pdf_file in enumerate(pdf_files, 1):
            print(f"\n[{idx}/{len(pdf_files)}] Processing: {os.path.basename(pdf_file)}")
            result = compress_pdf(driver, pdf_file, compression_level)
            results.append({
                'original': pdf_file,
                'compressed': result,
                'success': result is not None
            })
            
            # Wait between files to be nice to the server
            if idx < len(pdf_files):
                time.sleep(3)
        
        # Print summary
        print("\n" + "="*80)
        print("COMPRESSION SUMMARY")
        print("="*80)
        
        successful = sum(1 for r in results if r['success'])
        print(f"\nTotal files: {len(results)}")
        print(f"Successful: {successful}")
        print(f"Failed: {len(results) - successful}")
        
        if successful > 0:
            print(f"\nCompressed files saved to: {os.path.abspath(OUTPUT_DIR)}")
        
        print("\n" + "="*80)
        
    finally:
        driver.quit()
        print("\n[COMPLETE] Browser closed")

if __name__ == "__main__":
    main()