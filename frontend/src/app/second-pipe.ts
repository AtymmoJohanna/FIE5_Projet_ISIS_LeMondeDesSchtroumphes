import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'second',
})
export class SecondPipe implements PipeTransform {
  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }
}
