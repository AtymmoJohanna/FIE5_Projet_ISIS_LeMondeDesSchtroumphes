import { Pipe, PipeTransform } from '@angular/core';

// Transforme un temps en millisecondes en texte "h:mm:ss.d"
// exemple : 83500 -> "0:01:23.5"
@Pipe({
  name: 'second',
})
export class SecondPipe implements PipeTransform {
  transform(ms: number): string {
    const dixiemes = Math.ceil(ms / 100); // temps total en dixièmes de seconde
    const d = dixiemes % 10;
    const secondes = Math.floor(dixiemes / 10) % 60;
    const minutes = Math.floor(dixiemes / 600) % 60;
    const heures = Math.floor(dixiemes / 36000);
    // padStart(2, '0') ajoute un 0 devant si besoin : 5 -> "05"
    return (
      heures + ':' +
      String(minutes).padStart(2, '0') + ':' +
      String(secondes).padStart(2, '0') + '.' + d
    );
  }
}