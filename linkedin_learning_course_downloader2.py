#!/usr/bin/env python3
"""
LinkedIn Learning Course Downloader - Manual Login Version
Downloads both video transcripts and text articles from LinkedIn Learning courses
Supports batch downloading multiple courses with single login
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
OUTPUT_BASE_DIR = "./linkedin_courses"
MAX_RETRIES = 3
WAIT_TIMEOUT = 30


class LinkedInCourseDownloader:
    def __init__(self, course_url: str, headless: bool = False, driver=None):
        self.course_url = course_url.split('?')[0]
        print(f"[INFO] Course URL: {self.course_url}")
        
        self.headless = headless
        self.driver = driver  # Allow passing existing driver
        self.course_title = None
        self.course_slug = self.extract_course_slug(self.course_url)
        self.output_dir = None
        self.failed_items = []
        self.progress_file = None
        self.downloaded_urls = set()
    
    def extract_course_slug(self, url: str) -> str:
        """Extract the unique course identifier from URL"""
        # URL format: https://www.linkedin.com/learning/course-slug-here/optional-video-slug
        # We want just the course-slug-here part
        try:
            # Remove protocol and domain
            path = url.replace('https://www.linkedin.com/learning/', '')
            # Get first part (course slug) before any additional path
            slug = path.split('/')[0]
            # Clean it up
            slug = slug.strip('/')
            return slug if slug else "unknown-course"
        except:
            return "unknown-course"
        
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
    
    def safe_click(self, element):
        """Safely click an element"""
        try:
            self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
            time.sleep(0.5)
            try:
                element.click()
                return True
            except:
                self.driver.execute_script("arguments[0].click();", element)
                return True
        except Exception as e:
            print(f"[ERROR] Could not click element: {e}")
            return False
    
    def wait_for_manual_login(self):
        """Wait for user to manually log in"""
        print("\n" + "="*80)
        print("PLEASE LOG IN TO LINKEDIN LEARNING")
        print("="*80)
        print("\n[INFO] Opening LinkedIn Learning homepage...")
        
        self.driver.get("https://www.linkedin.com/learning/")
        time.sleep(3)
        
        print("\nPlease complete the following steps:")
        print("1. Log in to LinkedIn Learning in the browser window")
        print("2. Complete any 2FA/verification if prompted")
        print("3. Complete any external authentication (university SSO, etc.) if needed")
        print("4. Make sure you're logged in and can see the LinkedIn Learning homepage")
        print("5. Press ENTER here when you're ready to continue")
        print("="*80 + "\n")
        
        input("Press ENTER when logged in and ready to continue...")
        print("[OK] Continuing with course download...")
    
    def sanitize_filename(self, name: str) -> str:
        """Sanitize filename for safe filesystem use"""
        name = re.sub(r'[<>:"/\\|?*]', '', name)
        name = re.sub(r'\s+', '-', name)
        name = name.strip('-.')
        return name[:200]
    
    def get_course_title(self) -> str:
        """Extract course title from page"""
        selectors = [
            '.classroom-nav__title',
            '.course-header__title',
            'h1[data-live-test="course-title"]',
            '.top-card-layout__title h1'
        ]
        
        for selector in selectors:
            try:
                element = self.driver.find_element(By.CSS_SELECTOR, selector)
                title = element.text.strip()
                if title:
                    print(f"[INFO] Course title: {title}")
                    return title
            except NoSuchElementException:
                continue
        
        print("[WARN] Could not find course title, using URL-based name")
        return "LinkedIn-Learning-Course"
    
    def ensure_toc_open(self) -> bool:
        """Ensure the table of contents sidebar is open and all sections expanded"""
        try:
            toggle_button = self.driver.find_element(By.CSS_SELECTOR, "button.classroom-sidebar-toggle")
            is_expanded = toggle_button.get_attribute("aria-expanded")
            
            if is_expanded == "false":
                print("  [INFO] Opening table of contents...")
                self.safe_click(toggle_button)
                time.sleep(2)
            
            self.expand_all_sections()
            
            return True
        except NoSuchElementException:
            return True
        except Exception as e:
            print(f"  [WARN] Could not toggle TOC: {e}")
            return True
    
    def ensure_toc_closed(self) -> bool:
        """Ensure the table of contents sidebar is closed"""
        try:
            toggle_button = self.driver.find_element(By.CSS_SELECTOR, "button.classroom-sidebar-toggle")
            is_expanded = toggle_button.get_attribute("aria-expanded")
            
            if is_expanded == "true":
                print("  [INFO] Closing table of contents...")
                self.safe_click(toggle_button)
                time.sleep(2)
            
            return True
        except NoSuchElementException:
            return True
        except Exception as e:
            print(f"  [WARN] Could not close TOC: {e}")
            return True
    
    def expand_all_sections(self) -> bool:
        """Expand all collapsed sections in the TOC to get all videos"""
        try:
            section_toggles = self.driver.find_elements(By.CSS_SELECTOR, ".classroom-toc-section__toggle")
            
            if not section_toggles:
                return True
            
            expanded_count = 0
            
            for idx, toggle in enumerate(section_toggles, 1):
                try:
                    is_expanded = toggle.get_attribute("aria-expanded")
                    
                    if is_expanded == "false":
                        self.safe_click(toggle)
                        expanded_count += 1
                        time.sleep(0.3)
                    
                except Exception as e:
                    continue
            
            if expanded_count > 0:
                print(f"  [INFO] Expanded {expanded_count} sections")
                time.sleep(1)
            
            return True
            
        except Exception as e:
            print(f"  [WARN] Could not expand sections: {e}")
            return False
    
    def get_course_structure(self) -> List[Dict]:
        """Extract course structure (sections and items) - URLs only, no element references"""
        print("[INFO] Extracting course structure...")
        
        try:
            self.ensure_toc_open()
            
            WebDriverWait(self.driver, WAIT_TIMEOUT).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "section.classroom-toc-section"))
            )
            
            print("[INFO] Expanding all sections...")
            self.expand_all_sections()
            time.sleep(3)
            
            sections = self.driver.find_elements(By.CSS_SELECTOR, "section.classroom-toc-section")
            print(f"[INFO] Found {len(sections)} sections")
            
            course_structure = []
            
            for section_idx, section in enumerate(sections, 1):
                try:
                    title_elem = section.find_element(By.CSS_SELECTOR, ".classroom-toc-section__toggle-title")
                    section_title = title_elem.text.strip()
                except NoSuchElementException:
                    section_title = f"Section {section_idx}"
                
                print(f"[INFO] Processing section {section_idx}: {section_title}")
                
                items = []
                item_links = section.find_elements(By.CSS_SELECTOR, "a.classroom-toc-item__link")
                
                for item_link in item_links:
                    try:
                        title_elem = item_link.find_element(By.CSS_SELECTOR, ".classroom-toc-item__title")
                        item_title = title_elem.text.strip()
                        item_title = re.sub(r'\s*\([^)]*\)\s*$', '', item_title).strip()
                        
                        item_url = item_link.get_attribute("href")
                        item_url = item_url.split('?')[0] if item_url else None
                        
                        if not item_url:
                            print(f"  [WARN] No URL found for: {item_title}")
                            continue
                        
                        try:
                            type_elem = item_link.find_element(By.CSS_SELECTOR, "._bodyText_1e5nen._sizeXSmall_1e5nen span")
                            type_text = type_elem.text.strip().lower()
                            
                            if 'video' in type_text:
                                item_type = 'video'
                            elif 'text' in type_text:
                                item_type = 'text'
                            elif 'quiz' in type_text:
                                item_type = 'quiz'
                            else:
                                item_type = 'unknown'
                        except NoSuchElementException:
                            item_type = 'unknown'
                        
                        if item_type == 'quiz' or 'quiz' in item_title.lower():
                            print(f"  [SKIP] Quiz: {item_title}")
                            continue
                        
                        items.append({
                            'title': item_title,
                            'url': item_url,
                            'type': item_type
                        })
                        
                        print(f"  [{item_type.upper()}] {item_title}")
                        
                    except Exception as e:
                        print(f"  [WARN] Could not extract item info: {e}")
                        continue
                
                if items:
                    course_structure.append({
                        'section_title': section_title,
                        'items': items
                    })
            
            total_items = sum(len(section['items']) for section in course_structure)
            print(f"[INFO] Total items to download: {total_items}")
            
            return course_structure
            
        except Exception as e:
            print(f"[ERROR] Failed to extract course structure: {e}")
            return []
    
    def find_item_element_by_url(self, target_url: str) -> Optional[any]:
        """Find a fresh element reference by matching URL"""
        try:
            self.ensure_toc_open()
            
            WebDriverWait(self.driver, WAIT_TIMEOUT).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "a.classroom-toc-item__link"))
            )
            
            item_links = self.driver.find_elements(By.CSS_SELECTOR, "a.classroom-toc-item__link")
            
            for link in item_links:
                try:
                    href = link.get_attribute("href")
                    if href:
                        clean_href = href.split('?')[0]
                        if clean_href == target_url:
                            return link
                except:
                    continue
            
            return None
            
        except Exception as e:
            print(f"  [ERROR] Could not find element for URL: {e}")
            return None
    
    def get_current_item_title(self) -> Optional[str]:
        """Get the title of the currently displayed item"""
        selectors = [
            '.classroom-nav__subtitle',
            '.classroom-layout__video-title',
            '[data-test-id="video-title"]',
            'h1.video-title',
            '.classroom-nav__details h2',
            '.video-player__title'
        ]
        
        for selector in selectors:
            try:
                element = WebDriverWait(self.driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                title = element.text.strip()
                if title:
                    return title
            except (NoSuchElementException, TimeoutException):
                continue
        
        try:
            self.ensure_toc_open()
            active_item = self.driver.find_element(By.CSS_SELECTOR, "a.classroom-toc-item__link.active .classroom-toc-item__title")
            title = active_item.text.strip()
            if title:
                return title
        except:
            pass
        
        return None
    
    def navigate_to_item_by_url(self, item_url: str, item_title: str) -> bool:
        """Navigate to a course item by finding and clicking element with matching URL"""
        for attempt in range(MAX_RETRIES):
            try:
                print(f"  [NAV] Finding and clicking item (attempt {attempt + 1}/{MAX_RETRIES})...")
                
                item_element = self.find_item_element_by_url(item_url)
                
                if not item_element:
                    print(f"  [ERROR] Could not find element with URL: {item_url}")
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(4)
                        continue
                    return False
                
                self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", item_element)
                time.sleep(2)
                
                if self.safe_click(item_element):
                    time.sleep(6)
                    
                    self.ensure_toc_closed()
                    time.sleep(1)
                    
                    current_title = self.get_current_item_title()
                    
                    if current_title:
                        item_words = set(item_title.lower().split())
                        current_words = set(current_title.lower().split())
                        
                        if len(item_words & current_words) >= len(item_words) * 0.5:
                            print(f"  [OK] Successfully navigated to: {current_title}")
                            return True
                        else:
                            current_url = self.driver.current_url.split('?')[0]
                            if item_url in current_url or current_url in item_url:
                                print(f"  [OK] URL matches, proceeding anyway")
                                return True
                    else:
                        current_url = self.driver.current_url.split('?')[0]
                        if item_url in current_url or current_url in item_url:
                            print(f"  [OK] URL matches, proceeding anyway")
                            return True
                    
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(4)
                        continue
                else:
                    print(f"  [WARN] Click failed")
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(4)
                        continue
                    
            except Exception as e:
                print(f"  [ERROR] Navigation attempt {attempt + 1} failed: {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(4)
                    continue
        
        return False
    
    def click_transcript_button(self) -> bool:
        """Click the transcript button to reveal transcript panel"""
        selectors = [
            'button[data-live-test-classroom-layout-tab="TRANSCRIPT"]',
            'button[role="tab"][aria-controls*="transcript"]',
            'button[aria-label*="Transcript" i]',
            '.classroom-layout__workspace-tab[data-tab="transcript"]'
        ]
        
        for selector in selectors:
            try:
                button = WebDriverWait(self.driver, 5).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                )
                self.safe_click(button)
                time.sleep(3)
                print(f"  [OK] Clicked transcript button")
                return True
            except (TimeoutException, NoSuchElementException):
                continue
        
        try:
            buttons = self.driver.find_elements(By.CSS_SELECTOR, "button, [role='tab']")
            for button in buttons:
                text = button.text or button.get_attribute('aria-label') or ''
                if 'transcript' in text.lower():
                    self.safe_click(button)
                    time.sleep(3)
                    print(f"  [OK] Clicked transcript button by text")
                    return True
        except Exception as e:
            print(f"  [ERROR] Could not click transcript button: {e}")
        
        return False
    
    def extract_video_transcript(self) -> Optional[str]:
        """Extract video transcript from current page"""
        print(f"  [EXTRACT] Getting video transcript...")
        
        if not self.click_transcript_button():
            print(f"  [ERROR] Could not open transcript panel")
            return None
        
        selectors = [
            '.classroom-transcript__content .classroom-transcript__lines p',
            '.classroom-transcript__lines p',
            '.classroom-transcript__lines',
            '.classroom-transcript__content',
            '[class*="transcript"] p',
            '[class*="transcript-content"]'
        ]
        
        for attempt in range(MAX_RETRIES):
            time.sleep(3)
            
            for selector in selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        text_parts = []
                        for elem in elements:
                            text = elem.text.strip()
                            if text and len(text) > 10:
                                text_parts.append(text)
                        
                        if text_parts:
                            transcript = '\n\n'.join(text_parts)
                            if len(transcript) > 50:
                                print(f"  [OK] Extracted transcript ({len(transcript)} chars)")
                                return transcript
                
                except Exception as e:
                    continue
            
            print(f"  [WAIT] Waiting for transcript (attempt {attempt + 1}/{MAX_RETRIES})...")
        
        print(f"  [ERROR] Could not extract transcript after {MAX_RETRIES} attempts")
        return None
    
    def extract_text_article(self) -> Optional[str]:
        """Extract text article content from current page"""
        print(f"  [EXTRACT] Getting text article...")
        
        try:
            WebDriverWait(self.driver, WAIT_TIMEOUT).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".classroom-multimedia__content"))
            )
        except TimeoutException:
            print(f"  [ERROR] Text content did not load")
            return None
        
        try:
            content_div = self.driver.find_element(By.CSS_SELECTOR, ".classroom-multimedia__content")
            markdown = self.html_to_markdown(content_div)
            
            if markdown and len(markdown) > 50:
                print(f"  [OK] Extracted text article ({len(markdown)} chars)")
                return markdown
            else:
                print(f"  [ERROR] Article content too short or empty")
                return None
                
        except Exception as e:
            print(f"  [ERROR] Could not extract text article: {e}")
            return None
    
    def html_to_markdown(self, element) -> str:
        """Convert HTML element to markdown format"""
        markdown_lines = []
        children = element.find_elements(By.XPATH, "./*")
        
        for child in children:
            tag = child.tag_name.lower()
            text = child.text.strip()
            
            if not text:
                continue
            
            if tag == 'h1':
                markdown_lines.append(f"# {text}\n")
            elif tag == 'h2':
                markdown_lines.append(f"## {text}\n")
            elif tag == 'h3':
                markdown_lines.append(f"### {text}\n")
            elif tag == 'h4':
                markdown_lines.append(f"#### {text}\n")
            elif tag == 'p':
                try:
                    strong_tags = child.find_elements(By.TAG_NAME, "strong")
                    if strong_tags:
                        for strong in strong_tags:
                            text = text.replace(strong.text, f"**{strong.text}**")
                except:
                    pass
                markdown_lines.append(f"{text}\n")
            elif tag == 'ul':
                items = child.find_elements(By.TAG_NAME, "li")
                for item in items:
                    item_text = item.text.strip()
                    markdown_lines.append(f"- {item_text}")
                markdown_lines.append("")
            elif tag == 'ol':
                items = child.find_elements(By.TAG_NAME, "li")
                for idx, item in enumerate(items, 1):
                    item_text = item.text.strip()
                    markdown_lines.append(f"{idx}. {item_text}")
                markdown_lines.append("")
            elif tag == 'a':
                href = child.get_attribute('href')
                markdown_lines.append(f"[{text}]({href})")
            elif tag in ['strong', 'b']:
                markdown_lines.append(f"**{text}**")
            elif tag in ['em', 'i']:
                markdown_lines.append(f"*{text}*")
            else:
                markdown_lines.append(text)
        
        return '\n'.join(markdown_lines)
    
    def download_item(self, item: Dict, section_title: str) -> bool:
        """Download a single course item (video or text)"""
        item_title = item['title']
        item_url = item['url']
        item_type = item['type']
        
        print(f"\n[PROCESS] {item_title} ({item_type})")
        
        if self.is_item_downloaded(item_title, section_title):
            print(f"  [SKIP] Already downloaded")
            return True
        
        if not self.navigate_to_item_by_url(item_url, item_title):
            self.log_failed_item(item_title, section_title, item_url, "Failed to navigate")
            self.driver.get(self.course_url)
            time.sleep(6)
            self.ensure_toc_open()
            return False
        
        content = None
        if item_type == 'video':
            content = self.extract_video_transcript()
        elif item_type == 'text':
            content = self.extract_text_article()
        else:
            content = self.extract_video_transcript()
            if not content:
                content = self.extract_text_article()
        
        if not content:
            self.log_failed_item(item_title, section_title, item_url, "Could not extract content")
            self.driver.get(self.course_url)
            time.sleep(6)
            self.ensure_toc_open()
            return False
        
        try:
            filename = self.sanitize_filename(item_title) + '.md'
            filepath = self.output_dir / self.sanitize_filename(section_title) / filename
            filepath.parent.mkdir(parents=True, exist_ok=True)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f"# {item_title}\n\n")
                f.write(f"**Type:** {item_type}\n")
                f.write(f"**URL:** {item_url}\n")
                f.write(f"**Downloaded:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                f.write("---\n\n")
                f.write(content)
            
            print(f"  [SAVED] {filepath.relative_to(self.output_dir)}")
            
            self.mark_item_downloaded(item_url, item_title, section_title)
            
            print(f"  [NAV] Returning to course page...")
            self.driver.get(self.course_url)
            time.sleep(8)
            self.ensure_toc_open()
            time.sleep(2)
            
            return True
            
        except Exception as e:
            print(f"  [ERROR] Could not save file: {e}")
            self.log_failed_item(item_title, section_title, item_url, f"Save error: {e}")
            self.driver.get(self.course_url)
            time.sleep(6)
            self.ensure_toc_open()
            return False
    
    def log_failed_item(self, item_title: str, section_title: str, item_url: str, reason: str):
        """Log failed item for later reference"""
        self.failed_items.append({
            'title': item_title,
            'section': section_title,
            'url': item_url,
            'reason': reason,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
    
    def load_progress(self):
        """Load progress from previous runs"""
        if not self.progress_file.exists():
            return
        
        try:
            with open(self.progress_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        self.downloaded_urls.add(line)
            
            print(f"[INFO] Loaded {len(self.downloaded_urls)} previously downloaded items")
        except Exception as e:
            print(f"[WARN] Could not load progress file: {e}")
    
    def mark_item_downloaded(self, item_url: str, item_title: str, section_title: str):
        """Mark an item as downloaded"""
        self.downloaded_urls.add(item_url)
        
        try:
            with open(self.progress_file, 'a', encoding='utf-8') as f:
                f.write(f"{item_url}\n")
        except Exception as e:
            print(f"[WARN] Could not update progress file: {e}")
    
    def is_item_downloaded(self, item_title: str, section_title: str) -> bool:
        """Check if item file already exists on disk"""
        filename = self.sanitize_filename(item_title) + '.md'
        filepath = self.output_dir / self.sanitize_filename(section_title) / filename
        
        if filepath.exists():
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if len(content) > 200:
                        return True
            except Exception as e:
                print(f"  [WARN] Could not read existing file: {e}")
                return False
        
        return False
    
    def save_failed_log(self):
        """Save log of failed items"""
        if not self.failed_items:
            return
        
        log_file = self.output_dir / "_failed_items.md"
        
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write(f"# Failed Items - {self.course_title}\n\n")
            f.write(f"**Total Failed:** {len(self.failed_items)}\n")
            f.write(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("---\n\n")
            
            for item in self.failed_items:
                f.write(f"## {item['title']}\n\n")
                f.write(f"- **Section:** {item['section']}\n")
                f.write(f"- **URL:** {item['url']}\n")
                f.write(f"- **Reason:** {item['reason']}\n")
                f.write(f"- **Time:** {item['timestamp']}\n\n")
        
        print(f"\n[SAVED] Failed items log: {log_file}")
    
    def download_course(self):
        """Main method to download entire course"""
        print(f"[INFO] Navigating to course: {self.course_url}")
        self.driver.get(self.course_url)
        time.sleep(5)
        
        self.course_title = self.get_course_title()
        
        # Use course slug from URL as the primary directory identifier
        # This ensures each unique course URL gets its own directory
        dir_name = self.course_slug
        
        print(f"[DEBUG] Course slug: {self.course_slug}")
        print(f"[DEBUG] Directory name: {dir_name}")
        
        # Create the output directory
        self.output_dir = Path(OUTPUT_BASE_DIR) / dir_name
        
        # If directory exists, we're resuming - that's fine
        # If it doesn't exist, create it
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Store the course title in a metadata file for reference
        metadata_file = self.output_dir / "_course_info.txt"
        if not metadata_file.exists():
            try:
                with open(metadata_file, 'w', encoding='utf-8') as f:
                    f.write(f"Course Title: {self.course_title}\n")
                    f.write(f"Course URL: {self.course_url}\n")
                    f.write(f"Course Slug: {self.course_slug}\n")
                    f.write(f"Downloaded: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            except Exception as e:
                print(f"[WARN] Could not create metadata file: {e}")
        
        self.progress_file = self.output_dir / "_progress.txt"
        self.load_progress()
        
        print(f"[INFO] Output directory: {self.output_dir}")
        
        course_structure = self.get_course_structure()
        
        if not course_structure:
            print("[ERROR] No course content found")
            return False
        
        total_items = sum(len(section['items']) for section in course_structure)
        existing_count = 0
        for section in course_structure:
            section_title = section['section_title']
            for item in section['items']:
                if self.is_item_downloaded(item['title'], section_title):
                    existing_count += 1
        
        print(f"\n{'='*80}")
        print(f"STARTING DOWNLOAD")
        print(f"Course: {self.course_title}")
        print(f"Sections: {len(course_structure)}")
        print(f"Total Items: {total_items}")
        print(f"Already Downloaded: {existing_count}")
        print(f"To Download: {total_items - existing_count}")
        print(f"{'='*80}\n")
        
        success_count = 0
        skipped_count = 0
        
        for section_idx, section in enumerate(course_structure, 1):
            section_title = section['section_title']
            items = section['items']
            
            print(f"\n{'='*80}")
            print(f"SECTION {section_idx}/{len(course_structure)}: {section_title}")
            print(f"Items: {len(items)}")
            print(f"{'='*80}")
            
            for item_idx, item in enumerate(items, 1):
                print(f"\n[{item_idx}/{len(items)}] ", end='')
                
                if self.is_item_downloaded(item['title'], section_title):
                    print(f"[SKIP] {item['title']} (already exists)")
                    skipped_count += 1
                    if item['url'] not in self.downloaded_urls:
                        self.mark_item_downloaded(item['url'], item['title'], section_title)
                    success_count += 1
                elif self.download_item(item, section_title):
                    success_count += 1
                
                time.sleep(3)
            
            time.sleep(5)
        
        print(f"\n{'='*80}")
        print(f"DOWNLOAD COMPLETE")
        print(f"{'='*80}")
        print(f"Total Items: {total_items}")
        print(f"Skipped (existing): {skipped_count}")
        print(f"Downloaded (new): {success_count - skipped_count}")
        print(f"Successful: {success_count}")
        print(f"Failed: {len(self.failed_items)}")
        print(f"Output: {self.output_dir}")
        print(f"{'='*80}\n")
        
        if self.failed_items:
            self.save_failed_log()
        
        return True


def read_urls_from_file(filepath: str) -> List[str]:
    """Read course URLs from a text file, one per line"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            urls = []
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    url = line.split('?')[0]
                    if 'linkedin.com/learning' in url:
                        urls.append(url)
                    else:
                        print(f"[WARN] Skipping invalid URL: {line}")
            return urls
    except FileNotFoundError:
        print(f"[ERROR] File not found: {filepath}")
        return []
    except Exception as e:
        print(f"[ERROR] Could not read file {filepath}: {e}")
        return []


def main():
    if len(sys.argv) < 2:
        print("\nLinkedIn Learning Course Downloader - Batch Download")
        print("="*80)
        print("Required: pip install selenium webdriver-manager")
        print(f"Usage: python {sys.argv[0]} <course_url(s)> [options]")
        print("\nOptions:")
        print("  --headless                Run in headless mode")
        print("  --input <file>            Read URLs from input file (one per line)")
        print("\nExamples:")
        print(f"  Single course:")
        print(f"    python {sys.argv[0]} https://www.linkedin.com/learning/course-name")
        print(f"\n  Multiple courses (comma-separated):")
        print(f"    python {sys.argv[0]} \"url1,url2,url3\"")
        print(f"\n  From input file:")
        print(f"    python {sys.argv[0]} --input courses.txt")
        print(f"\n  With headless mode:")
        print(f"    python {sys.argv[0]} --input courses.txt --headless")
        print("\nInput file format (courses.txt):")
        print("  https://www.linkedin.com/learning/course-1")
        print("  https://www.linkedin.com/learning/course-2")
        print("  # Comments start with #")
        print("  https://www.linkedin.com/learning/course-3")
        print("="*80)
        sys.exit(1)
    
    headless = '--headless' in sys.argv
    course_urls = []
    
    if '--input' in sys.argv:
        try:
            input_idx = sys.argv.index('--input')
            if input_idx + 1 < len(sys.argv):
                input_file = sys.argv[input_idx + 1]
                course_urls = read_urls_from_file(input_file)
                if not course_urls:
                    print("[ERROR] No valid URLs found in input file")
                    sys.exit(1)
            else:
                print("[ERROR] --input requires a filename")
                sys.exit(1)
        except ValueError:
            pass
    else:
        url_arg = sys.argv[1]
        
        if ',' in url_arg:
            course_urls = [url.strip().split('?')[0] for url in url_arg.split(',')]
        else:
            course_urls = [url_arg.split('?')[0]]
    
    valid_urls = []
    for url in course_urls:
        if 'linkedin.com/learning' in url:
            valid_urls.append(url)
        else:
            print(f"[ERROR] Invalid LinkedIn Learning URL: {url}")
    
    if not valid_urls:
        print("[ERROR] No valid LinkedIn Learning URLs provided")
        print("URL should be like: https://www.linkedin.com/learning/course-name")
        sys.exit(1)
    
    print("\n" + "="*80)
    print("BATCH DOWNLOAD SUMMARY")
    print("="*80)
    print(f"Total courses to download: {len(valid_urls)}")
    print(f"Headless mode: {'Yes' if headless else 'No'}")
    print("="*80)
    for idx, url in enumerate(valid_urls, 1):
        print(f"{idx}. {url}")
    print("="*80 + "\n")
    
    driver = None
    completed_courses = []
    failed_courses = []
    
    try:
        chrome_options = Options()
        
        if headless:
            chrome_options.add_argument("--headless=new")
        
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("--start-maximized")
        chrome_options.add_argument("--disable-notifications")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        print(f"[INFO] Starting Chrome browser...")
        
        driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=chrome_options
        )
        driver.set_window_size(1400, 900)
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        print("\n" + "="*80)
        print("PLEASE LOG IN TO LINKEDIN LEARNING")
        print("="*80)
        print("\n[INFO] Opening LinkedIn Learning homepage...")
        
        driver.get("https://www.linkedin.com/learning/")
        time.sleep(3)
        
        print("\nPlease complete the following steps:")
        print("1. Log in to LinkedIn Learning in the browser window")
        print("2. Complete any 2FA/verification if prompted")
        print("3. Complete any external authentication (university SSO, etc.) if needed")
        print("4. Make sure you're logged in and can see the LinkedIn Learning homepage")
        print("5. Press ENTER here when you're ready to continue")
        print("="*80 + "\n")
        
        input("Press ENTER when logged in and ready to continue...")
        print("[OK] Login complete. Starting batch download...\n")
        
        total_courses = len(valid_urls)
        
        for course_idx, course_url in enumerate(valid_urls, 1):
            print("\n" + "="*80)
            print(f"COURSE {course_idx}/{total_courses}")
            print("="*80)
            print(f"URL: {course_url}")
            print("="*80 + "\n")
            
            try:
                downloader = LinkedInCourseDownloader(
                    course_url=course_url,
                    headless=headless,
                    driver=driver
                )
                
                if downloader.download_course():
                    completed_courses.append(course_url)
                else:
                    failed_courses.append((course_url, "Download returned False"))
                
            except KeyboardInterrupt:
                print("\n[CANCELLED] Batch download cancelled by user")
                break
            except Exception as e:
                print(f"\n[ERROR] Failed to download course {course_idx}: {e}")
                failed_courses.append((course_url, str(e)))
                import traceback
                traceback.print_exc()
            
            if course_idx < total_courses:
                print(f"\n[INFO] Waiting 10 seconds before next course...")
                time.sleep(10)
        
        print("\n" + "="*80)
        print("BATCH DOWNLOAD COMPLETE")
        print("="*80)
        print(f"Total courses: {total_courses}")
        print(f"Completed: {len(completed_courses)}")
        print(f"Failed: {len(failed_courses)}")
        print("="*80)
        
        if completed_courses:
            print("\nCompleted courses:")
            for idx, url in enumerate(completed_courses, 1):
                print(f"  {idx}. {url}")
        
        if failed_courses:
            print("\nFailed courses:")
            for idx, (url, error) in enumerate(failed_courses, 1):
                print(f"  {idx}. {url}")
                print(f"      Error: {error}")
        
        print("="*80 + "\n")
        
    except KeyboardInterrupt:
        print("\n[CANCELLED] Batch download cancelled by user")
    except Exception as e:
        print(f"\n[ERROR] Fatal error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            driver.quit()
            print("\n[CLEANUP] Browser closed")


if __name__ == "__main__":
    main()