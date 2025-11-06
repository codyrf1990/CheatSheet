/**
 * PageSystem - Manages companies with multiple pages
 * Auto-saves all changes, tracks favorites and recent companies
 */

const CURRENT_COMPANY_KEY = 'solidcam-current-company-id';
const COMPANIES_STORAGE_KEY = 'solidcam-companies';
const FAVORITES_STORAGE_KEY = 'solidcam-favorites';
const RECENT_STORAGE_KEY = 'solidcam-recent';

// Old keys for migration
const OLD_PAGES_KEY = 'solidcam-pages-data';
const OLD_STATE_KEY = 'solidcam-cheatsheet-state';

function generateId(prefix = 'page') {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export class PageSystem {
  constructor() {
    this.currentCompanyId = null;
    this.companies = [];
    this.favoriteCompanyIds = [];
    this.recentCompanyIds = [];
  }

  /**
   * Load page system from localStorage
   * Handles migration from old system
   */
  load() {
    try {
      const currentId = localStorage.getItem(CURRENT_COMPANY_KEY);
      const companiesRaw = localStorage.getItem(COMPANIES_STORAGE_KEY);
      const favoritesRaw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const recentRaw = localStorage.getItem(RECENT_STORAGE_KEY);

      if (companiesRaw) {
        // Load new structure
        this.companies = JSON.parse(companiesRaw);
        this.currentCompanyId = currentId && this.companies.find(c => c.id === currentId)
          ? currentId
          : this.companies[0]?.id || null;

        // Load favorites
        if (favoritesRaw) {
          this.favoriteCompanyIds = JSON.parse(favoritesRaw);
        }

        // Load recent
        if (recentRaw) {
          this.recentCompanyIds = JSON.parse(recentRaw);
        }
      } else {
        // MIGRATION: Check for old structure
        const oldPages = localStorage.getItem(OLD_PAGES_KEY);
        const oldCompanies = localStorage.getItem(COMPANIES_STORAGE_KEY);

        if (oldPages) {
          // Migrate old "working pages" to a company
          const oldData = JSON.parse(oldPages);
          const newCompany = {
            id: generateId('comp'),
            name: 'Untitled Company',
            pages: oldData.pages || [],
            currentPageId: oldData.currentPageId || (oldData.pages?.[0]?.id || null),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastAccessed: Date.now(),
            isFavorite: false
          };
          this.companies = [newCompany];
          this.currentCompanyId = newCompany.id;
        } else {
          // Check for very old single-state structure
          const oldState = localStorage.getItem(OLD_STATE_KEY);
          if (oldState) {
            const newCompany = {
              id: generateId('comp'),
              name: 'Untitled Company',
              pages: [{
                id: generateId('page'),
                name: 'P1',
                state: JSON.parse(oldState)
              }],
              currentPageId: null,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              lastAccessed: Date.now(),
              isFavorite: false
            };
            newCompany.currentPageId = newCompany.pages[0].id;
            this.companies = [newCompany];
            this.currentCompanyId = newCompany.id;
          }
        }

        // Migrate old saved companies (if they exist as separate entries)
        if (oldCompanies) {
          const oldCompaniesList = JSON.parse(oldCompanies);
          oldCompaniesList.forEach(oldComp => {
            // Skip if we already migrated this as working pages
            if (this.companies.length === 1 && this.companies[0].name === 'Untitled Company') {
              // Replace the untitled one if it's empty
              const untitled = this.companies[0];
              if (untitled.pages.length === 1 &&
                  Object.keys(untitled.pages[0].state?.panels || {}).length === 0 &&
                  Object.keys(untitled.pages[0].state?.packages || {}).length === 0) {
                this.companies = [];
              }
            }

            this.companies.push({
              id: oldComp.id,
              name: oldComp.name,
              pages: oldComp.pages,
              currentPageId: oldComp.pages[0]?.id || null,
              createdAt: new Date(oldComp.savedAt).getTime(),
              updatedAt: new Date(oldComp.savedAt).getTime(),
              lastAccessed: new Date(oldComp.savedAt).getTime(),
              isFavorite: false
            });
          });
        }

        // Clean up old keys after migration
        localStorage.removeItem(OLD_PAGES_KEY);
        // Don't remove old companies key yet in case migration fails
      }

      // Ensure at least one company exists
      if (this.companies.length === 0) {
        this.createCompany('Untitled Company');
      }

      // Ensure currentCompanyId is set
      if (!this.currentCompanyId || !this.companies.find(c => c.id === this.currentCompanyId)) {
        this.currentCompanyId = this.companies[0].id;
      }

      // Ensure all companies have required fields
      this.companies.forEach(company => {
        if (!company.createdAt) company.createdAt = Date.now();
        if (!company.updatedAt) company.updatedAt = Date.now();
        if (!company.lastAccessed) company.lastAccessed = Date.now();
        if (company.isFavorite === undefined) company.isFavorite = false;
        if (!company.currentPageId && company.pages.length > 0) {
          company.currentPageId = company.pages[0].id;
        }
      });

      this.save();

    } catch (error) {
      console.error('[PageSystem] Failed to load:', error);
      // Fallback: Create empty company
      this.createCompany('Untitled Company');
    }
  }

  /**
   * Save page system to localStorage
   */
  save() {
    try {
      localStorage.setItem(CURRENT_COMPANY_KEY, this.currentCompanyId);
      localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(this.companies));
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(this.favoriteCompanyIds));
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(this.recentCompanyIds));
    } catch (error) {
      console.error('[PageSystem] Failed to save:', error);
    }
  }

  /**
   * Get current company object
   */
  getCurrentCompany() {
    return this.companies.find(c => c.id === this.currentCompanyId) || null;
  }

  /**
   * Get current page ID (from current company)
   */
  getCurrentPageId() {
    const company = this.getCurrentCompany();
    return company?.currentPageId || null;
  }

  /**
   * Get current pages (from current company)
   */
  getPages() {
    const company = this.getCurrentCompany();
    return company?.pages || [];
  }

  /**
   * Save current company's page state
   */
  saveCurrentPageState(pageId, state) {
    const company = this.getCurrentCompany();
    if (!company) return;

    const page = company.pages.find(p => p.id === pageId);
    if (page) {
      page.state = state;
      company.updatedAt = Date.now();
      this.save();
    }
  }

  /**
   * Switch to a different company
   */
  switchToCompany(companyId) {
    const company = this.companies.find(c => c.id === companyId);
    if (!company) {
      console.error('[PageSystem] Company not found:', companyId);
      return false;
    }

    this.currentCompanyId = companyId;
    company.lastAccessed = Date.now();
    this.trackRecentAccess(companyId);
    this.save();
    return true;
  }

  /**
   * Create new company
   */
  createCompany(name = 'Untitled Company') {
    const company = {
      id: generateId('comp'),
      name: name,
      pages: [{
        id: generateId('page'),
        name: 'P1',
        state: { panels: {}, packages: {} }
      }],
      currentPageId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessed: Date.now(),
      isFavorite: false
    };

    company.currentPageId = company.pages[0].id;
    this.companies.push(company);
    this.currentCompanyId = company.id;
    this.trackRecentAccess(company.id);
    this.save();
    return company;
  }

  /**
   * Duplicate a company
   */
  duplicateCompany(companyId) {
    const source = this.companies.find(c => c.id === companyId);
    if (!source) return null;

    const copy = JSON.parse(JSON.stringify(source));
    copy.id = generateId('comp');
    copy.name = source.name + ' (Copy)';
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.lastAccessed = Date.now();
    copy.isFavorite = false;

    // Regenerate page IDs
    copy.pages = copy.pages.map(page => ({
      ...page,
      id: generateId('page')
    }));
    copy.currentPageId = copy.pages[0].id;

    this.companies.push(copy);
    this.save();
    return copy;
  }

  /**
   * Rename current company
   */
  renameCurrentCompany(newName) {
    const company = this.getCurrentCompany();
    if (!company) return false;

    company.name = newName;
    company.updatedAt = Date.now();
    this.save();
    return true;
  }

  /**
   * Delete a company
   */
  deleteCompany(companyId) {
    const index = this.companies.findIndex(c => c.id === companyId);
    if (index === -1) return null;

    this.companies.splice(index, 1);

    // Remove from favorites if present
    const favIndex = this.favoriteCompanyIds.indexOf(companyId);
    if (favIndex > -1) {
      this.favoriteCompanyIds.splice(favIndex, 1);
    }

    // Remove from recent if present
    const recentIndex = this.recentCompanyIds.indexOf(companyId);
    if (recentIndex > -1) {
      this.recentCompanyIds.splice(recentIndex, 1);
    }

    // If deleted current company, switch to another
    if (companyId === this.currentCompanyId) {
      if (this.companies.length > 0) {
        this.currentCompanyId = this.companies[0].id;
        this.trackRecentAccess(this.currentCompanyId);
      } else {
        // No companies left, create a new one
        this.createCompany('Untitled Company');
      }
    }

    this.save();
    return this.currentCompanyId;
  }

  /**
   * Create page in current company
   */
  createPage(name = null) {
    const company = this.getCurrentCompany();
    if (!company) return null;

    const pageNum = company.pages.length + 1;
    const page = {
      id: generateId('page'),
      name: name || `P${pageNum}`,
      state: { panels: {}, packages: {} }
    };

    company.pages.push(page);
    company.updatedAt = Date.now();
    this.save();
    return page;
  }

  /**
   * Switch to page in current company
   */
  switchToPage(pageId) {
    const company = this.getCurrentCompany();
    if (!company) return;

    const page = company.pages.find(p => p.id === pageId);
    if (!page) {
      console.error('[PageSystem] Page not found:', pageId);
      return;
    }

    company.currentPageId = pageId;
    this.save();
  }

  /**
   * Rename page in current company
   */
  renamePage(pageId, newName) {
    const company = this.getCurrentCompany();
    if (!company) return;

    const page = company.pages.find(p => p.id === pageId);
    if (!page) return;

    page.name = newName.substring(0, 8);
    company.updatedAt = Date.now();
    this.save();
  }

  /**
   * Delete page from current company
   */
  deletePage(pageId) {
    const company = this.getCurrentCompany();
    if (!company || company.pages.length <= 1) {
      console.warn('[PageSystem] Cannot delete last page');
      return company?.currentPageId || null;
    }

    const index = company.pages.findIndex(p => p.id === pageId);
    if (index === -1) return company.currentPageId;

    company.pages.splice(index, 1);

    // Determine next page
    let nextPageId;
    if (index < company.pages.length) {
      nextPageId = company.pages[index].id;
    } else {
      nextPageId = company.pages[index - 1].id;
    }

    company.currentPageId = nextPageId;
    company.updatedAt = Date.now();
    this.save();
    return nextPageId;
  }

  /**
   * Copy page in current company
   */
  copyPage(pageId, newName = null) {
    const company = this.getCurrentCompany();
    if (!company) return null;

    const sourcePage = company.pages.find(p => p.id === pageId);
    if (!sourcePage) return null;

    const pageNum = company.pages.length + 1;
    const page = {
      id: generateId('page'),
      name: newName || `P${pageNum}`,
      state: JSON.parse(JSON.stringify(sourcePage.state))
    };

    company.pages.push(page);
    company.updatedAt = Date.now();
    this.save();
    return page;
  }

  /**
   * Get current page state
   */
  getCurrentPageState() {
    const company = this.getCurrentCompany();
    if (!company) return { panels: {}, packages: {} };

    const page = company.pages.find(p => p.id === company.currentPageId);
    return page ? page.state : { panels: {}, packages: {} };
  }

  /**
   * Get page name
   */
  getPageName(pageId) {
    const company = this.getCurrentCompany();
    if (!company) return '';

    const page = company.pages.find(p => p.id === pageId);
    return page ? page.name : '';
  }

  /**
   * Get current page name
   */
  getCurrentPageName() {
    const company = this.getCurrentCompany();
    if (!company) return 'P1';

    const page = company.pages.find(p => p.id === company.currentPageId);
    return page ? page.name : 'P1';
  }

  /**
   * Toggle favorite
   */
  toggleFavorite(companyId) {
    const index = this.favoriteCompanyIds.indexOf(companyId);
    if (index > -1) {
      this.favoriteCompanyIds.splice(index, 1);
    } else {
      // Limit to 10 favorites
      if (this.favoriteCompanyIds.length >= 10) {
        this.favoriteCompanyIds.shift();
      }
      this.favoriteCompanyIds.push(companyId);
    }
    this.save();
  }

  /**
   * Track recent access
   */
  trackRecentAccess(companyId) {
    // Remove if already in list
    const index = this.recentCompanyIds.indexOf(companyId);
    if (index > -1) {
      this.recentCompanyIds.splice(index, 1);
    }

    // Add to front
    this.recentCompanyIds.unshift(companyId);

    // Keep max 20
    if (this.recentCompanyIds.length > 20) {
      this.recentCompanyIds = this.recentCompanyIds.slice(0, 20);
    }

    this.save();
  }

  /**
   * Get favorites
   */
  getFavorites() {
    return this.favoriteCompanyIds
      .map(id => this.companies.find(c => c.id === id))
      .filter(c => c !== undefined);
  }

  /**
   * Get recent companies
   */
  getRecent(limit = 10) {
    return this.recentCompanyIds
      .slice(0, limit)
      .map(id => this.companies.find(c => c.id === id))
      .filter(c => c !== undefined);
  }

  /**
   * Search companies (fuzzy match)
   */
  searchCompanies(query) {
    if (!query || query.trim() === '') {
      return this.companies;
    }

    const lowerQuery = query.toLowerCase().trim();

    return this.companies.filter(company => {
      const name = company.name.toLowerCase();

      // Exact match
      if (name.includes(lowerQuery)) return true;

      // Fuzzy match (allow missing characters)
      let queryIndex = 0;
      for (let i = 0; i < name.length && queryIndex < lowerQuery.length; i++) {
        if (name[i] === lowerQuery[queryIndex]) {
          queryIndex++;
        }
      }
      return queryIndex === lowerQuery.length;
    });
  }

  /**
   * Reset pages in current company to single default page
   * Keeps company data, only resets page structure
   */
  resetPages() {
    const company = this.getCurrentCompany();
    if (!company) return;

    // Reset to single default page with empty state
    const defaultPage = {
      id: generateId('page'),
      name: 'P1',
      state: { panels: {}, packages: {} }
    };

    company.pages = [defaultPage];
    company.currentPageId = defaultPage.id;
    company.updatedAt = Date.now();
    this.save();
  }
}
