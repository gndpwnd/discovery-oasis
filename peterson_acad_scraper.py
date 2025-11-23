#!/usr/bin/env python3
"""
Peterson Academy Course Scraper
Downloads transcripts from Peterson Academy courses
Supports resume from where it left off
"""

import os
import sys
import time
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

# --- CONFIG ---
OUTPUT_BASE_DIR = "./courses"
MAX_RETRIES = 3
WAIT_TIMEOUT = 30


class PetersonAcademyScraper:
    def __init__(self, headless: bool = False):
        self.headless = headless
        self.driver = None
        self.failed_items = []
    
    def setup_driver(self):
        """Setup Chrome driver with appropriate options"""
        chrome_options = Options()
        
        if self.headless:
            chrome_options.add_argument("--headless=new")
        
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("--start-maximized")
        chrome_options.add_argument("--disable-notifications")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        print(f"[INFO] Starting Chrome browser...")
        
        self.driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=chrome_options
        )
        self.driver.set_window_size(1400, 900)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    def wait_for_manual_login(self):
        """Wait for user to manually log in"""
        print("\n" + "="*80)
        print("PLEASE LOG IN TO PETERSON ACADEMY")
        print("="*80)
        print("\n[INFO] Opening Peterson Academy homepage...")
        
        self.driver.get("https://petersonacademy.com")
        time.sleep(3)
        
        print("\nPlease complete the following steps:")
        print("1. Log in to Peterson Academy in the browser window")
        print("2. Complete any 2FA/verification if prompted")
        print("3. Make sure you're logged in and can see the Peterson Academy homepage")
        print("4. Press ENTER here when you're ready to continue")
        print("="*80 + "\n")
        
        input("Press ENTER when logged in and ready to continue...")
        print("[OK] Continuing with scraping...")
    
    def sanitize_filename(self, name: str) -> str:
        """Sanitize filename for safe filesystem use"""
        name = re.sub(r'[<>:"/\\|?*]', '', name)
        name = re.sub(r'\s+', '_', name)
        name = name.strip('-._')
        return name[:200]
    
    def load_existing_course_links(self) -> Optional[List[str]]:
        """Load course links from existing file if it exists"""
        filepath = Path(OUTPUT_BASE_DIR) / "all_course_links.md"
        
        if not filepath.exists():
            return None
        
        print(f"[INFO] Found existing course links file: {filepath}")
        
        course_links = []
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    # Look for lines that start with numbers (numbered list)
                    if re.match(r'^\d+\.\s+https?://', line):
                        # Extract URL
                        url = re.search(r'https?://[^\s]+', line)
                        if url:
                            course_links.append(url.group(0))
            
            print(f"[INFO] Loaded {len(course_links)} course links from file")
            return course_links if course_links else None
            
        except Exception as e:
            print(f"[WARN] Could not load existing course links: {e}")
            return None
    
    def load_existing_lecture_links(self, course_slug: str) -> Optional[List[Dict[str, str]]]:
        """Load lecture links from existing file if it exists"""
        filepath = Path(OUTPUT_BASE_DIR) / course_slug / "lecture_links.md"
        
        if not filepath.exists():
            return None
        
        print(f"  [INFO] Found existing lecture links file")
        
        lectures = []
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
                # Parse lecture entries
                # Format: "1. **Title**\n   - URL\n\n"
                pattern = r'\d+\.\s+\*\*(.+?)\*\*\s+\-\s+(https?://[^\s]+)'
                matches = re.findall(pattern, content)
                
                for title, url in matches:
                    lectures.append({
                        'title': title,
                        'url': url
                    })
            
            print(f"  [INFO] Loaded {len(lectures)} lecture links from file")
            return lectures if lectures else None
            
        except Exception as e:
            print(f"  [WARN] Could not load existing lecture links: {e}")
            return None
    
    def transcript_exists(self, course_slug: str, lecture_title: str) -> bool:
        """Check if transcript file already exists"""
        course_dir = Path(OUTPUT_BASE_DIR) / course_slug
        
        # Use the lecture title for the filename (not course title)
        filename = self.sanitize_filename(lecture_title) + '.md'
        filepath = course_dir / filename
        
        if filepath.exists():
            # Verify file has content
            try:
                if filepath.stat().st_size > 200:  # At least 200 bytes
                    return True
            except:
                pass
        
        return False
    
    def get_all_course_links(self) -> List[str]:
        """Get all course links from the main courses page"""
        print("\n[INFO] Navigating to courses page...")
        self.driver.get("https://petersonacademy.com/courses")
        time.sleep(5)
        
        print("[INFO] Extracting all course links...")
        
        # Scroll to load all courses
        last_height = self.driver.execute_script("return document.body.scrollHeight")
        while True:
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            new_height = self.driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height:
                break
            last_height = new_height
        
        course_links = []
        try:
            # Find all course card links
            course_elements = self.driver.find_elements(By.CSS_SELECTOR, "a.course-card")
            
            for elem in course_elements:
                try:
                    href = elem.get_attribute("href")
                    if href and "/courses/" in href:
                        # Clean URL
                        clean_url = href.split('?')[0].split('#')[0]
                        if clean_url not in course_links:
                            course_links.append(clean_url)
                            print(f"  Found: {clean_url}")
                except Exception as e:
                    continue
            
            print(f"\n[INFO] Found {len(course_links)} courses")
            
        except Exception as e:
            print(f"[ERROR] Failed to extract course links: {e}")
        
        return course_links
    
    def save_course_links(self, course_links: List[str]):
        """Save all course links to a file"""
        output_dir = Path(OUTPUT_BASE_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        filepath = output_dir / "all_course_links.md"
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("# Peterson Academy - All Course Links\n\n")
            f.write(f"**Total Courses:** {len(course_links)}\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("---\n\n")
            
            for idx, link in enumerate(course_links, 1):
                f.write(f"{idx}. {link}\n")
        
        print(f"\n[SAVED] Course links saved to: {filepath}")
    
    def extract_course_slug(self, url: str) -> str:
        """Extract course slug from URL"""
        # URL format: https://petersonacademy.com/courses/introduction-to-music-theory
        try:
            parts = url.rstrip('/').split('/')
            slug = parts[-1]
            return slug if slug else "unknown-course"
        except:
            return "unknown-course"
    
    def click_view_more_lectures(self) -> bool:
        """Click 'View More' button if it exists to show all lectures"""
        try:
            # Look for "View More" button
            view_more_buttons = self.driver.find_elements(By.XPATH, "//button[contains(text(), 'View More')]")
            
            while view_more_buttons:
                button = view_more_buttons[0]
                print("  [INFO] Clicking 'View More' to load all lectures...")
                self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
                time.sleep(1)
                button.click()
                time.sleep(3)
                
                # Check for more buttons
                view_more_buttons = self.driver.find_elements(By.XPATH, "//button[contains(text(), 'View More')]")
            
            # Verify we can now see "View Less"
            view_less = self.driver.find_elements(By.XPATH, "//button[contains(text(), 'View Less')]")
            if view_less:
                print("  [OK] All lectures are now visible")
                return True
            
            return True
            
        except Exception as e:
            print(f"  [WARN] Could not expand lecture list: {e}")
            return False
    
    def get_lecture_links(self, course_url: str) -> List[Dict[str, str]]:
        """Get all lecture links from a course page"""
        print(f"\n[INFO] Navigating to course: {course_url}")
        self.driver.get(course_url)
        time.sleep(5)
        
        # Click "View More" to show all lectures
        self.click_view_more_lectures()
        time.sleep(2)
        
        lectures = []
        try:
            # Find all lecture article elements
            lecture_articles = self.driver.find_elements(By.CSS_SELECTOR, "article.group\\/lesson-tile")
            
            print(f"[INFO] Found {len(lecture_articles)} lectures")
            
            for article in lecture_articles:
                try:
                    # Find the link
                    link_elem = article.find_element(By.CSS_SELECTOR, "a[href*='/lecture-']")
                    href = link_elem.get_attribute("href")
                    
                    # Find the title
                    title_elem = article.find_element(By.CSS_SELECTOR, "h2.font-bold")
                    title = title_elem.text.strip()
                    
                    if href and title:
                        clean_url = href.split('?')[0].split('#')[0]
                        lectures.append({
                            'url': clean_url,
                            'title': title
                        })
                        print(f"  [{len(lectures)}] {title}")
                
                except Exception as e:
                    continue
            
        except Exception as e:
            print(f"[ERROR] Failed to extract lecture links: {e}")
        
        return lectures
    
    def save_lecture_links(self, course_slug: str, course_url: str, lectures: List[Dict[str, str]]):
        """Save lecture links to a file"""
        course_dir = Path(OUTPUT_BASE_DIR) / course_slug
        course_dir.mkdir(parents=True, exist_ok=True)
        
        filepath = course_dir / "lecture_links.md"
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"# Lecture Links - {course_slug}\n\n")
            f.write(f"**Course URL:** {course_url}\n")
            f.write(f"**Total Lectures:** {len(lectures)}\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("---\n\n")
            
            for idx, lecture in enumerate(lectures, 1):
                f.write(f"{idx}. **{lecture['title']}**\n")
                f.write(f"   - {lecture['url']}\n\n")
        
        print(f"\n[SAVED] Lecture links saved to: {filepath}")
    
    def click_transcript_tab(self) -> bool:
        """Click the Transcript tab to show transcript content"""
        try:
            # Find and click the Transcript tab button
            transcript_buttons = self.driver.find_elements(By.XPATH, "//button[@role='tab'][contains(., 'Transcript')]")
            
            if not transcript_buttons:
                print("  [WARN] Could not find Transcript tab")
                return False
            
            button = transcript_buttons[0]
            
            # Check if already selected
            aria_current = button.get_attribute("aria-current")
            if aria_current == "true":
                print("  [INFO] Transcript tab already active")
                return True
            
            print("  [INFO] Clicking Transcript tab...")
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
            time.sleep(1)
            button.click()
            time.sleep(3)
            
            return True
            
        except Exception as e:
            print(f"  [ERROR] Could not click transcript tab: {e}")
            return False
    
    def extract_transcript(self) -> Optional[str]:
        """Extract transcript text from the page"""
        print("  [EXTRACT] Getting transcript...")
        
        # Make sure transcript tab is active
        if not self.click_transcript_tab():
            return None
        
        time.sleep(2)
        
        try:
            # Find the transcript container
            transcript_container = self.driver.find_element(By.CSS_SELECTOR, "div[data-testid='notes-container']")
            
            # Find all paragraph elements
            paragraphs = transcript_container.find_elements(By.CSS_SELECTOR, "p.text-secondary")
            
            if not paragraphs:
                print("  [WARN] No transcript paragraphs found")
                return None
            
            transcript_parts = []
            
            for para in paragraphs:
                # Get all span elements within the paragraph
                spans = para.find_elements(By.CSS_SELECTOR, "span[role='button']")
                
                if spans:
                    # Combine text from all spans in the paragraph
                    para_text = ' '.join([span.text.strip() for span in spans if span.text.strip()])
                    if para_text:
                        transcript_parts.append(para_text)
            
            if transcript_parts:
                transcript = '\n\n'.join(transcript_parts)
                print(f"  [OK] Extracted transcript ({len(transcript)} characters)")
                return transcript
            else:
                print("  [WARN] No transcript text found")
                return None
                
        except Exception as e:
            print(f"  [ERROR] Failed to extract transcript: {e}")
            return None
    
    def get_course_title(self) -> Optional[str]:
        """Get the course title from the page"""
        try:
            # Find the course title element
            title_elem = self.driver.find_element(By.CSS_SELECTOR, "h1.text-primary a")
            title = title_elem.text.strip()
            return title if title else None
        except:
            try:
                # Alternative: try to get from page title
                title = self.driver.title
                return title if title else None
            except:
                return None
    
    def download_lecture_transcript(self, course_slug: str, lecture_url: str, lecture_title: str) -> bool:
        """Download transcript for a single lecture"""
        print(f"\n[PROCESS] {lecture_title}")
        
        # Check if already exists
        if self.transcript_exists(course_slug, lecture_title):
            print(f"  [SKIP] Transcript already exists")
            return True
        
        print(f"  [URL] {lecture_url}")
        
        # Navigate to lecture
        self.driver.get(lecture_url)
        time.sleep(5)
        
        # Extract transcript
        transcript = self.extract_transcript()
        
        if not transcript:
            self.failed_items.append({
                'course': course_slug,
                'lecture': lecture_title,
                'url': lecture_url,
                'reason': 'Could not extract transcript'
            })
            return False
        
        # Get the course title for metadata
        course_title = self.get_course_title()
        if not course_title:
            course_title = course_slug.replace('_', ' ').title()
        
        # Save transcript - USE LECTURE TITLE FOR FILENAME!
        try:
            course_dir = Path(OUTPUT_BASE_DIR) / course_slug
            course_dir.mkdir(parents=True, exist_ok=True)
            
            # Important: Use lecture_title for filename, not course_title
            filename = self.sanitize_filename(lecture_title) + '.md'
            filepath = course_dir / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f"# {lecture_title}\n\n")
                f.write(f"**Course:** {course_title}\n")
                f.write(f"**URL:** {lecture_url}\n")
                f.write(f"**Downloaded:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                f.write("---\n\n")
                f.write(transcript)
            
            print(f"  [SAVED] {filepath}")
            return True
            
        except Exception as e:
            print(f"  [ERROR] Could not save transcript: {e}")
            self.failed_items.append({
                'course': course_slug,
                'lecture': lecture_title,
                'url': lecture_url,
                'reason': f'Save error: {e}'
            })
            return False
    
    def save_failed_log(self):
        """Save log of failed items"""
        if not self.failed_items:
            return
        
        output_dir = Path(OUTPUT_BASE_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        log_file = output_dir / "_failed_items.md"
        
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write(f"# Failed Items - Peterson Academy\n\n")
            f.write(f"**Total Failed:** {len(self.failed_items)}\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("---\n\n")
            
            for item in self.failed_items:
                f.write(f"## {item['lecture']}\n\n")
                f.write(f"- **Course:** {item['course']}\n")
                f.write(f"- **URL:** {item['url']}\n")
                f.write(f"- **Reason:** {item['reason']}\n\n")
        
        print(f"\n[SAVED] Failed items log: {log_file}")
    
    def run(self):
        """Main execution method with resume capability"""
        try:
            self.setup_driver()
            self.wait_for_manual_login()
            
            # Step 1: Get all course links (or load existing)
            print("\n" + "="*80)
            print("STEP 1: GETTING ALL COURSE LINKS")
            print("="*80)
            
            course_links = self.load_existing_course_links()
            
            if course_links:
                print(f"[RESUME] Using existing course links ({len(course_links)} courses)")
            else:
                course_links = self.get_all_course_links()
                if not course_links:
                    print("[ERROR] No courses found!")
                    return
                self.save_course_links(course_links)
            
            # Step 2 & 3: Process each course
            print("\n" + "="*80)
            print("STEP 2 & 3: PROCESSING COURSES AND DOWNLOADING TRANSCRIPTS")
            print("="*80)
            
            for course_idx, course_url in enumerate(course_links, 1):
                print(f"\n{'='*80}")
                print(f"COURSE [{course_idx}/{len(course_links)}]: {course_url}")
                print(f"{'='*80}")
                
                course_slug = self.extract_course_slug(course_url)
                
                # Try to load existing lecture links
                lectures = self.load_existing_lecture_links(course_slug)
                
                if lectures:
                    print(f"[RESUME] Using existing lecture links ({len(lectures)} lectures)")
                else:
                    # Get lecture links
                    lectures = self.get_lecture_links(course_url)
                    
                    if not lectures:
                        print(f"[WARN] No lectures found for {course_slug}")
                        continue
                    
                    self.save_lecture_links(course_slug, course_url, lectures)
                
                # Check which transcripts need to be downloaded
                missing_transcripts = []
                for lecture in lectures:
                    if not self.transcript_exists(course_slug, lecture['title']):
                        missing_transcripts.append(lecture)
                
                if not missing_transcripts:
                    print(f"[SKIP] All transcripts already exist for {course_slug}")
                    continue
                
                print(f"\n[INFO] Need to download {len(missing_transcripts)}/{len(lectures)} transcripts")
                
                # Download missing transcripts
                success_count = 0
                for lecture_idx, lecture in enumerate(missing_transcripts, 1):
                    print(f"\n[{lecture_idx}/{len(missing_transcripts)}] ", end='')
                    
                    if self.download_lecture_transcript(
                        course_slug,
                        lecture['url'],
                        lecture['title']
                    ):
                        success_count += 1
                    
                    time.sleep(3)
                
                print(f"\n[COURSE COMPLETE] Downloaded {success_count}/{len(missing_transcripts)} transcripts")
                time.sleep(3)
            
            # Summary
            total_lectures = 0
            total_downloaded = 0
            
            for course_url in course_links:
                course_slug = self.extract_course_slug(course_url)
                lectures = self.load_existing_lecture_links(course_slug)
                if lectures:
                    total_lectures += len(lectures)
                    for lecture in lectures:
                        if self.transcript_exists(course_slug, lecture['title']):
                            total_downloaded += 1
            
            print("\n" + "="*80)
            print("SCRAPING COMPLETE")
            print("="*80)
            print(f"Total Courses: {len(course_links)}")
            print(f"Total Lectures: {total_lectures}")
            print(f"Transcripts Downloaded: {total_downloaded}")
            print(f"Failed: {len(self.failed_items)}")
            print(f"Output Directory: {OUTPUT_BASE_DIR}")
            print("="*80 + "\n")
            
            if self.failed_items:
                self.save_failed_log()
            
        except KeyboardInterrupt:
            print("\n[CANCELLED] Scraping cancelled by user")
        except Exception as e:
            print(f"\n[ERROR] Fatal error: {e}")
            import traceback
            traceback.print_exc()
        finally:
            if self.driver:
                self.driver.quit()
                print("\n[CLEANUP] Browser closed")


def main():
    headless = '--headless' in sys.argv
    
    print("\n" + "="*80)
    print("PETERSON ACADEMY COURSE SCRAPER")
    print("="*80)
    print(f"Headless mode: {'Yes' if headless else 'No'}")
    print(f"Resume capability: ENABLED")
    print("="*80 + "\n")
    
    scraper = PetersonAcademyScraper(headless=headless)
    scraper.run()


if __name__ == "__main__":
    main()