import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-page404',
  templateUrl: './page404.component.html',
  styleUrls: ['./page404.component.scss']
})

/**
 * 404 Basic Component
 */
export class page404Component implements OnInit {
  // set the current year
  year: number = new Date().getFullYear();

  constructor(private router: Router) {}

  ngOnInit(): void {}

  goToDashboard(): void {
    // Navigate to dashboard using absolute path
    this.router.navigate(['/']);
  }
}
