// utils/storage.js
class DataStorage {
    constructor() {
        this.data = {};
        this.fieldMappings = {};
        this.loaded = false;
        this.loadData();
    }
    
    async loadData() {
        try {
            // Load all JSON data files
            const files = [
                'my_information.json',
                'application_questions.json', 
                'work_experience.json',
                'voluntary_disclosure.json',
                'self_identify.json'
            ];
            
            for (const filename of files) {
                try {
                    const data = await this.loadJsonFile(filename);
                    if (data) {
                        this.data[filename.replace('.json', '')] = data;
                        logger.info(`Loaded ${filename}`);
                    }
                } catch (error) {
                    logger.warning(`Could not load ${filename}:`, error);
                }
            }
            
            this.buildFieldMappings();
            this.loaded = true;
            logger.info('All data files processed and mappings built');
            
        } catch (error) {
            logger.error('Failed to load data files', error);
        }
    }
    
    async loadJsonFile(filename) {
        try {
            const response = await fetch(chrome.runtime.getURL(`data/${filename}`));
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            logger.debug(`Error loading ${filename}:`, error.message);
            return null;
        }
    }
    
    buildFieldMappings() {
        // Build comprehensive mappings from your JSON structure
        this.fieldMappings = {};
        
        // Process each loaded data file
        for (const [sourceFile, sourceData] of Object.entries(this.data)) {
            this.processDataSource(sourceFile, sourceData);
        }
        
        logger.debug('Field mappings built:', Object.keys(this.fieldMappings).length, 'total mappings');
    }
    
    processDataSource(sourceFile, data, prefix = '') {
        if (!data || typeof data !== 'object') return;
        
        for (const [key, value] of Object.entries(data)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                // Recursively process nested objects
                this.processDataSource(sourceFile, value, fullKey);
            } else {
                // Create mapping entry
                this.createFieldMapping(key, fullKey, value, sourceFile);
            }
        }
    }
    
    createFieldMapping(key, fullKey, value, sourceFile) {
        // Create various mapping strategies
        const mappings = [
            key.toLowerCase(),                           // Direct key match
            fullKey.toLowerCase(),                       // Full path match  
            key.replace(/([A-Z])/g, '-$1').toLowerCase(), // camelCase to kebab-case
            key.replace(/([A-Z])/g, ' $1').toLowerCase(), // camelCase to space-separated
            this.keyToLabel(key),                        // Convert key to human-readable label
            this.keyToLabel(fullKey)                     // Convert full path to label
        ];
        
        // Add specific Workday field mappings
        const workdayMappings = this.getWorkdayFieldMappings(key, fullKey);
        mappings.push(...workdayMappings);
        
        for (const mapping of mappings) {
            if (mapping && mapping.length > 1) {
                this.fieldMappings[mapping] = {
                    value: value,
                    source: sourceFile,
                    originalKey: key,
                    fullPath: fullKey
                };
            }
        }
    }
    
    getWorkdayFieldMappings(key, fullKey) {
        // Specific mappings for common Workday field patterns
        const mappings = [];
        const lowerKey = key.toLowerCase();
        const lowerFullKey = fullKey.toLowerCase();
        
        // Name field mappings
        if (lowerKey.includes('firstname') || lowerFullKey.includes('firstname')) {
            mappings.push('first name', 'firstname', 'given name', 'legalname--firstname');
        }
        if (lowerKey.includes('lastname') || lowerFullKey.includes('lastname')) {
            mappings.push('last name', 'lastname', 'family name', 'surname', 'legalname--lastname');
        }
        if (lowerKey.includes('middlename') || lowerFullKey.includes('middlename')) {
            mappings.push('middle name', 'middlename', 'legalname--middlename');
        }
        
        // Contact information
        if (lowerKey.includes('email')) {
            mappings.push('email address', 'email', 'e-mail');
        }
        if (lowerKey.includes('phone')) {
            mappings.push('phone number', 'telephone', 'mobile', 'cell phone');
        }
        
        // Address fields
        if (lowerKey.includes('address')) {
            mappings.push('street address', 'address line 1', 'address');
        }
        if (lowerKey.includes('city')) {
            mappings.push('city', 'town');
        }
        if (lowerKey.includes('state')) {
            mappings.push('state', 'province', 'region');
        }
        if (lowerKey.includes('postal') || lowerKey.includes('zip')) {
            mappings.push('postal code', 'zip code', 'zip', 'postcode');
        }
        
        // Employment questions
        if (lowerKey.includes('salary')) {
            mappings.push('salary expectations', 'expected salary', 'compensation');
        }
        if (lowerKey.includes('start') && lowerKey.includes('date')) {
            mappings.push('start date', 'available to start', 'when are you available');
        }
        if (lowerKey.includes('notice')) {
            mappings.push('notice period', 'notice required', 'notice to give');
        }
        
        // Demographics
        if (lowerKey.includes('veteran')) {
            mappings.push('veteran status', 'are you a veteran');
        }
        if (lowerKey.includes('ethnicity') || lowerKey.includes('race')) {
            mappings.push('race/ethnicity', 'ethnicity', 'race');
        }
        if (lowerKey.includes('gender')) {
            mappings.push('gender', 'sex');
        }
        if (lowerKey.includes('disability')) {
            mappings.push('disability status', 'do you have a disability');
        }
        
        // Yes/No questions
        if (lowerKey.includes('relocate')) {
            mappings.push('willing to relocate', 'relocation');
        }
        if (lowerKey.includes('relatives')) {
            mappings.push('relatives employed', 'family members');
        }
        if (lowerKey.includes('compete')) {
            mappings.push('non-compete', 'non-compete agreement');
        }
        if (lowerKey.includes('clearance')) {
            mappings.push('security clearance', 'clearance');
        }
        if (lowerKey.includes('authorization') || lowerKey.includes('authorized')) {
            mappings.push('work authorization', 'authorized to work');
        }
        if (lowerKey.includes('visa') || lowerKey.includes('sponsorship')) {
            mappings.push('visa sponsorship', 'require sponsorship');
        }
        
        return mappings;
    }
    
    keyToLabel(key) {
        // Convert programmatic key to human-readable label
        return key
            .replace(/([A-Z])/g, ' $1')        // Add space before capitals
            .replace(/[-_]/g, ' ')             // Replace dashes/underscores with spaces
            .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
            .trim()
            .toLowerCase();
    }
    
    getValue(fieldType, identifier, label, automationId) {
        if (!this.loaded) {
            logger.warning('Data not yet loaded');
            return null;
        }
        
        logger.debug(`Looking for value: type=${fieldType}, id=${identifier}, label="${label}", automation="${automationId}"`);
        
        // Try multiple search strategies in order of specificity
        const searchStrategies = [
            () => this.findByAutomationId(automationId),
            () => this.findByExactId(identifier),
            () => this.findByExactLabel(label),
            () => this.findByPartialMatch(identifier, label, automationId),
            () => this.findByFieldType(fieldType, label),
            () => this.findSpecialCases(fieldType, identifier, label)
        ];
        
        for (const strategy of searchStrategies) {
            try {
                const result = strategy();
                if (result !== null && result !== undefined) {
                    logger.debug(`Found value using strategy:`, result);
                    return result;
                }
            } catch (error) {
                logger.debug('Search strategy error:', error);
            }
        }
        
        logger.debug(`No value found for field: ${label || identifier || automationId}`);
        return null;
    }
    
    findByAutomationId(automationId) {
        if (!automationId) return null;
        
        const normalized = automationId.toLowerCase();
        return this.fieldMappings[normalized]?.value || null;
    }
    
    findByExactId(identifier) {
        if (!identifier) return null;
        
        const normalized = identifier.toLowerCase();
        return this.fieldMappings[normalized]?.value || null;
    }
    
    findByExactLabel(label) {
        if (!label) return null;
        
        const normalized = label.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        for (const [key, mapping] of Object.entries(this.fieldMappings)) {
            const normalizedKey = key.replace(/[^a-z0-9]/g, '');
            if (normalizedKey === normalized) {
                return mapping.value;
            }
        }
        
        return null;
    }
    
    findByPartialMatch(identifier, label, automationId) {
        const searchTerms = [identifier, label, automationId].filter(Boolean);
        
        for (const term of searchTerms) {
            if (!term) continue;
            
            const normalized = term.toLowerCase();
            
            // Try partial matches
            for (const [key, mapping] of Object.entries(this.fieldMappings)) {
                if (key.includes(normalized) || normalized.includes(key)) {
                    return mapping.value;
                }
            }
        }
        
        return null;
    }
    
    findByFieldType(fieldType, label) {
        // Special handling based on field type
        if (fieldType === 'multiselect' && label && label.toLowerCase().includes('skill')) {
            return this.getSkillsList();
        }
        
        if (fieldType === 'date' && (!label || label.toLowerCase().includes('today'))) {
            return this.getTodayDate();
        }
        
        return null;
    }
    
    findSpecialCases(fieldType, identifier, label) {
        // Handle special cases and common patterns
        
        // Today's date for various date fields
        if ((label && (label.toLowerCase().includes('date') || 
                      label.toLowerCase().includes('when') ||
                      label.toLowerCase().includes('available'))) ||
            (identifier && identifier.toLowerCase().includes('date'))) {
            
            const dateResponse = this.getTodayDate();
            if (fieldType === 'date') {
                return dateResponse; // Return date object
            } else {
                return dateResponse['mm/dd/yyyy']; // Return formatted string
            }
        }
        
        // Default responses for common yes/no questions
        const yesNoPatterns = {
            'relocate': 'Yes',
            'willing': 'Yes', 
            'authorized': 'Yes',
            'relatives': 'No',
            'compete': 'No',
            'clearance': 'No',
            'sponsorship': 'No',
            'veteran': 'No',
            'disability': 'No',
            'accept': 'Yes',
            'consent': 'I Accept'
        };
        
        if (label) {
            const lowerLabel = label.toLowerCase();
            for (const [pattern, response] of Object.entries(yesNoPatterns)) {
                if (lowerLabel.includes(pattern)) {
                    return response;
                }
            }
        }
        
        // Default values for common demographics
        if (label && label.toLowerCase().includes('country')) {
            return 'United States of America';
        }
        
        if (label && label.toLowerCase().includes('language')) {
            return 'English';
        }
        
        return null;
    }
    
    getSkillsList() {
        // Return the comprehensive skills list
        return [
            'Linux', 'Bash', 'Windows', 'PowerShell', 'Python', 'MacOS', 'Raspberry Pi', 'Rust', 
            'Golang', 'JavaScript', 'CSS', 'SQL', 'C', 'C++', 'PHP', 'Git', 'GitHub', 'Nginx', 
            'WordPress', 'Kubernetes', 'Docker', 'Hugo', 'Markdown', 'YAML', 'MS Word', 'Excel', 
            'PowerPoint', 'Teams', 'Microsoft Office Apps', 'Arduino', 'Matlab', 'Ham Radio Technician', 
            'ISC2 Certified in Cybersecurity', 'CompTIA A+', 'Leadership', 'Team Collaboration', 
            'Problem-solving', 'Communication', 'Project Management', 'Research Skills', 'Data Analysis', 
            'Technical Documentation', 'Mentoring', 'Grant Writing', 'Budget Management', 
            'Equipment Management', 'Training', 'Safety Management', 'Risk Assessment', 'Time Management', 
            'Adaptability', 'Critical Thinking', 'Innovation', 'Detail-oriented', 'Multi-tasking', 
            'Quality Assurance', 'Process Improvement', 'Teamwork', 'Organizational Skills', 
            'Analytical Thinking', 'Creative Problem Solving', 'Strategic Planning', 'Resource Allocation', 
            'Cross-functional Collaboration', 'Technical Writing', 'Presentation Skills', 
            'Stakeholder Management', 'Process Optimization', 'Continuous Improvement', 
            'Self-motivated', 'Results-driven', 'Robotics', 'Full-stack Development', 'AI', 
            'Machine Learning', 'Cybersecurity', 'OSINT', 'Systems Engineering', 'Real-time Systems', 
            'Situational Awareness Systems', 'Aerospace Engineering', 'Remote Operations', 
            'Heavy Machinery Operation', 'Wilderness Safety', 'First Aid', 'CPR', 'Trail Construction', 
            'Web Development', 'Database Management', 'API Development', 'Data Visualization', 
            'Automated Testing', 'Web Scraping', 'Report Generation', 'Network Analysis', 
            'Sensor Integration', 'Quaternion Mathematics', 'Flask', 'HTML', 'PostgreSQL', 
            'Qdrant', 'Neo4j', 'Docker Compose', 'Google Dorking', 'Documentation Writing'
        ];
    }
    
    getTodayDate() {
        const today = new Date();
        return {
            'mm/dd/yyyy': `${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`,
            'month': (today.getMonth() + 1).toString(),
            'day': today.getDate().toString(),
            'year': today.getFullYear().toString(),
            'formatted': today.toLocaleDateString('en-US')
        };
    }
    
    // Debug methods
    debugMappings() {
        logger.info('=== FIELD MAPPINGS DEBUG ===');
        for (const [key, mapping] of Object.entries(this.fieldMappings)) {
            logger.info(`"${key}" -> "${mapping.value}" (from: ${mapping.source})`);
        }
        logger.info('=== END MAPPINGS DEBUG ===');
    }
    
    searchMappings(searchTerm) {
        const results = [];
        const normalized = searchTerm.toLowerCase();
        
        for (const [key, mapping] of Object.entries(this.fieldMappings)) {
            if (key.includes(normalized) || normalized.includes(key)) {
                results.push({ key, value: mapping.value, source: mapping.source });
            }
        }
        
    }
}

// Create global instance
const dataStorage = new DataStorage();