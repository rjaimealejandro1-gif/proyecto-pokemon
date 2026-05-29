import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoggerService {

  public log(message: string, ...args: any[]): void {
    console.log(`%c[GAME LOG]: ${message}`, 'color: #00b4d8; font-weight: bold;', ...args);
  }

  public warn(message: string, ...args: any[]): void {
    console.warn(`%c[GAME WARN]: ${message}`, 'color: #ffb703; font-weight: bold;', ...args);
  }

  public error(message: string, ...args: any[]): void {
    console.error(`%c[GAME ERROR]: ${message}`, 'color: #e63946; font-weight: bold;', ...args);
  }
}
