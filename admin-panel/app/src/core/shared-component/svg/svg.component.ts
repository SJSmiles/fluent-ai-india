import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icon',
  templateUrl: './svg.component.html',
  standalone: true,
  imports: [CommonModule]
})
export class IconComponent {
  @Input() iconType: string = '';
}
