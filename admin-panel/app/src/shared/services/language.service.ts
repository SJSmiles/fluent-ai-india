import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CookieService } from 'ngx-cookie-service';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private languageSubject = new BehaviorSubject<string>(this.getStoredLanguage());
  public language$ = this.languageSubject.asObservable();

  public languages: string[] = ['en', 'de'];

  constructor(
    public translate: TranslateService,
    private cookieService: CookieService
  ) {
    let browserLang: any;
    this.translate.addLangs(this.languages);
    if (localStorage.getItem('lang')) {
      browserLang = localStorage.getItem('lang');
    } else {
      browserLang = translate.getBrowserLang();
    }
    translate.use(browserLang.match(/en|de|/) ? browserLang : 'en');
    this.setLanguage(browserLang);
  }

  getStoredLanguage(): string {
    return this.translate.currentLang || 'en';
  }

  public translateKey(key: string, interpolateParams?: any): string {
    return this.translate.instant(key, interpolateParams);
  }

  public setLanguage(lang: any) {
    this.translate.use(lang);
    this.languageSubject.next(lang);
    localStorage.setItem('lang', lang);
  }
}
