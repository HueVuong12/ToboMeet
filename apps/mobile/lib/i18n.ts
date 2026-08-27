import i18n, { LanguageDetectorAsyncModule } from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en.json";
import vi from "./locales/vi.json";

const STORE_LANGUAGE_KEY = "settings.lang";

const languageDetectorPlugin: LanguageDetectorAsyncModule = {
  type: "languageDetector",
  async: true,
  init: () => {},

  detect: (callback: (lng: string) => void) => {
    AsyncStorage.getItem(STORE_LANGUAGE_KEY)
      .then((savedLanguage) => {
        if (savedLanguage) {
          const lang = savedLanguage.startsWith("vi") ? "vi" : "en";
          return callback(lang);
        }
        const rawLanguage = Localization.getLocales()[0]?.languageCode;
        const phoneLanguage = rawLanguage && rawLanguage.startsWith("en") ? "en" : "vi";
        callback(phoneLanguage);
      })
      .catch((error) => {
        console.log("Lỗi đọc ngôn ngữ", error);
        callback("vi");
      });
  },

  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(STORE_LANGUAGE_KEY, language);
    } catch (error) {
      console.log("Lỗi lưu ngôn ngữ", error);
    }
  },
};

i18n
  .use(languageDetectorPlugin)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    fallbackLng: "vi",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
